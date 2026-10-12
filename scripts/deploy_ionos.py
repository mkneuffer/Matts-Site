#!/usr/bin/env python3
"""Validate the destination, preview, upload with lftp/SFTP, and verify files."""

import argparse
import hashlib
import os
from pathlib import Path, PurePosixPath
import shlex
import shutil
import subprocess
import tempfile

from prepare_site import ROOT, SOURCE, public_files

HOST = "home677718046.1and1-data.host"
USER = "u88981197"
PORT = 22
# No trailing slash here: lftp mirror otherwise appends the local directory name.
DESTINATION = "/mainsite"
FINGERPRINT = "SHA256:1gx2w8Rtv3wCgi7Jh8myf/KVd72cRQbow03UP8P095Q"
KNOWN_HOSTS = ROOT / "deployment/ionos_known_hosts"
REPRESENTATIVE_FILES = ["index.html", "styles.css", "hero3d.js", "images/web/esamtac.jpg",
                        "Resume/Matthew Neuffer Resume.pdf"]


def quote(value):
    return '"' + str(value).replace("\\", "\\\\").replace('"', '\\"').replace("$", "\\$") + '"'


def validate_source():
    expected = public_files()
    if SOURCE.is_symlink() or SOURCE.parent.is_symlink() or not SOURCE.is_dir():
        raise ValueError("Source .deploy/site/ is missing or symlinked; run prepare_site.py")
    actual = []
    for path in SOURCE.rglob("*"):
        if path.is_symlink():
            raise ValueError(f"Symlink in deployment source: {path}")
        if path.is_file():
            actual.append(path.relative_to(SOURCE).as_posix())
    if sorted(actual) != expected:
        raise ValueError("Source must contain exactly the manifest's tracked public files")
    for name in expected:
        if digest(SOURCE / name) != digest(ROOT / name):
            raise ValueError(f"Staged file differs from the repository: {name}")
    return expected


def digest(path):
    return hashlib.sha256(path.read_bytes()).digest()


class SFTP:
    def __init__(self, temporary):
        self.temporary = Path(temporary)
        self.environment = os.environ.copy()
        self.environment["LFTP_HOME"] = str(self.temporary)
        ssh = ["ssh", "-F", "/dev/null", "-a", "-x", "-o", "StrictHostKeyChecking=yes",
               "-o", f"UserKnownHostsFile={KNOWN_HOSTS}", "-o", "GlobalKnownHostsFile=/dev/null",
               "-o", "HostKeyAlgorithms=ssh-ed25519", "-o", "UpdateHostKeys=no",
               "-o", "CheckHostIP=no", "-o", "ConnectTimeout=15",
               "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=2",
               "-o", "PreferredAuthentications=password", "-o", "PubkeyAuthentication=no",
               "-o", "KbdInteractiveAuthentication=no", "-o", "NumberOfPasswordPrompts=1"]
        self.settings = "\n".join([
            "set cmd:fail-exit yes", "set cmd:trace no", "set cmd:move-background no",
            "set color:use-color no", "set log:enabled no", "set log:enabled/xfer no",
            "set net:timeout 30", "set net:max-retries 2", "set net:reconnect-interval-base 5",
            "set net:reconnect-interval-max 10", "set sftp:auto-confirm no",
            "set cache:enable no", "set xfer:clobber yes",
            f"set sftp:connect-program {quote(shlex.join(ssh))}",
            f"open --env-password --user {quote(USER)} -p {PORT} sftp://{HOST}",
        ])

    def run(self, commands, phase, timeout=150):
        try:
            result = subprocess.run(["lftp", "--norc"],
                                    input=self.settings + "\n" + commands + "\nbye\n",
                                    text=True, capture_output=True, env=self.environment,
                                    timeout=timeout)
        except subprocess.TimeoutExpired as error:
            raise ValueError(f"{phase} exceeded its {timeout}-second timeout") from error
        # No trace/debug mode or password-bearing command is used. Redact defensively.
        password = self.environment["LFTP_PASSWORD"]
        output = (result.stdout + result.stderr).replace(password, "[REDACTED]")
        if result.returncode:
            raise ValueError(f"{phase} failed (lftp exit {result.returncode}):\n{output}")
        return output

    def listings(self, paths):
        commands = []
        for index, path in enumerate(paths):
            commands.extend([f"echo LISTING_{index}", f"cls -1 -a -F --basename {quote(path)}"])
        commands.append(f"echo LISTING_{len(paths)}")
        output = self.run("\n".join(commands), "SFTP destination validation")
        results = {}
        for index, path in enumerate(paths):
            start = f"LISTING_{index}\n"
            end = f"LISTING_{index + 1}\n"
            if output.count(start) != 1 or output.count(end) != 1:
                raise ValueError("Unexpected SFTP directory listing format")
            entries = output.split(start, 1)[1].split(end, 1)[0].splitlines()
            results[path] = {entry for entry in entries if entry not in {"./", "../"}}
        return results

    def validate_destination(self, names):
        root_entries = self.listings(["/"])["/"]
        if "mainsite/" not in root_entries or "mainsite@" in root_entries:
            raise ValueError("/mainsite/ must already exist as a real SFTP-visible directory")
        self.run(f"cd {quote(DESTINATION)}\npwd", "SFTP destination resolution")
        wanted = {}
        for name in names:
            path = PurePosixPath(name)
            for index, part in enumerate(path.parts):
                parent = "/".join(path.parts[:index])
                wanted.setdefault(parent, {})[part] = index < len(path.parts) - 1
        pending = [""]
        while pending:
            paths = {parent: DESTINATION + ("/" + parent if parent else "") for parent in pending}
            listings = self.listings(list(paths.values()))
            next_pending = []
            for parent, remote in paths.items():
                entries = listings[remote]
                for name, is_directory in wanted[parent].items():
                    if name + "@" in entries:
                        raise ValueError(f"Refusing to write through remote symlink: {remote}/{name}")
                    if is_directory:
                        if name in entries:
                            raise ValueError(f"Remote file blocks a required directory: {remote}/{name}")
                        if name + "/" in entries:
                            next_pending.append((parent + "/" + name).lstrip("/"))
                    elif name + "/" in entries:
                        raise ValueError(f"Remote directory blocks a public file: {remote}/{name}")
            pending = next_pending
        print("Verified SFTP authentication, pinned host identity, and /mainsite/ paths")

    def mirror(self, dry_run):
        options = "--reverse --upload-older --no-perms --no-symlinks --parallel=2 --max-errors=1 --verbose=1"
        if dry_run:
            options += " --dry-run"
        return self.run(f"cd {quote(DESTINATION)}\nmirror {options} {quote(SOURCE)} {quote(DESTINATION)}",
                        "No-write transfer preview" if dry_run else "SFTP upload", timeout=600)

    def verify_files(self):
        commands = [f"cd {quote(DESTINATION)}"]
        for index, name in enumerate(REPRESENTATIVE_FILES):
            commands.append(f"get {quote(name)} -o {quote(self.temporary / str(index))}")
        self.run("\n".join(commands), "SFTP read-back verification")
        for index, name in enumerate(REPRESENTATIVE_FILES):
            if digest(self.temporary / str(index)) != digest(SOURCE / name):
                raise ValueError(f"Uploaded file does not match the source: {name}")
        print(f"Verified SHA-256 read-back for {len(REPRESENTATIVE_FILES)} representative deployed files")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--deploy", action="store_true", help="Upload after a successful no-write preview")
    parser.add_argument("--dry-run", action="store_true", help="Preview only (the default)")
    args = parser.parse_args()
    if args.deploy and args.dry_run:
        raise ValueError("Choose either --deploy or --dry-run")
    if os.environ.get("GITHUB_ACTIONS") == "true" and (
            os.environ.get("GITHUB_REF") != "refs/heads/main"
            or os.environ.get("GITHUB_REPOSITORY") != "mkneuffer/Matts-Site"):
        raise ValueError("Production SFTP access is restricted to mkneuffer/Matts-Site on main")
    names = validate_source()
    if not os.environ.get("LFTP_PASSWORD"):
        raise ValueError("Missing IONOS_SFTP_PASSWORD: add it under Settings > Secrets and variables > Actions")
    for program in ["lftp", "ssh", "ssh-keygen"]:
        if not shutil.which(program):
            raise ValueError(f"Required deployment tool is missing: {program}")
    fingerprint = subprocess.check_output(["ssh-keygen", "-lf", str(KNOWN_HOSTS), "-E", "sha256"], text=True)
    if fingerprint.split()[1] != FINGERPRINT:
        raise ValueError("The committed IONOS host key does not match the verified fingerprint")
    print(f"Deployment source: {len(names)} public files; destination: sftp://{HOST}:{PORT}/mainsite/")
    with tempfile.TemporaryDirectory(prefix="ionos-") as temporary:
        client = SFTP(temporary)
        client.validate_destination(names)
        print(client.mirror(dry_run=True))
        if args.deploy:
            print(client.mirror(dry_run=False))
            client.verify_files()
            print("Live SFTP deployment completed successfully")
        else:
            print("Dry-run completed successfully; no remote files or directories were changed")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        raise SystemExit(f"IONOS deployment failed: {error}")
