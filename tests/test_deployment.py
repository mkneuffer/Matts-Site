"""Deployment safety tests and real lftp integration against temporary local files."""

from contextlib import redirect_stdout
import io
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import deploy_ionos as deploy
import prepare_site as prepare


class ManifestTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="ionos-manifest-test-")
        self.root = Path(self.temporary.name).resolve()
        subprocess.run(["git", "init", "-q", str(self.root)], check=True)
        (self.root / "deployment").mkdir()
        (self.root / "deployment/public-files.txt").write_text("index.html\nimages/\n? .htaccess\n")
        (self.root / "index.html").write_text('<img src="images/photo.jpg">')
        (self.root / "images").mkdir()
        (self.root / "images/photo.jpg").write_bytes(b"image")
        subprocess.run(["git", "-C", str(self.root), "add", "."], check=True)

    def tearDown(self):
        self.temporary.cleanup()

    def track(self, name, content):
        (self.root / name).write_text(content)
        subprocess.run(["git", "-C", str(self.root), "add", name], check=True)

    def test_only_manifest_public_files_and_public_dotfile(self):
        self.track(".htaccess", "DirectoryIndex index.html")
        self.track(".env", "PRIVATE=excluded")
        self.track("README.md", "Development documentation")
        (self.root / "images/untracked.jpg").write_text("untracked")
        self.assertEqual(prepare.public_files(self.root), [".htaccess", "images/photo.jpg", "index.html"])

    def test_tracked_private_file_under_public_directory_is_rejected(self):
        self.track("images/.env", "PRIVATE=excluded")
        with self.assertRaisesRegex(ValueError, "Unsafe public path"):
            prepare.public_files(self.root)

    def test_tracked_symlink_is_rejected(self):
        (self.root / "images/link.jpg").symlink_to(self.root / "index.html")
        subprocess.run(["git", "-C", str(self.root), "add", "images/link.jpg"], check=True)
        with self.assertRaisesRegex(ValueError, "symlink"):
            prepare.public_files(self.root)

    def test_required_file_and_reference_failures(self):
        (self.root / "index.html").write_text('<img src="images/missing.jpg">')
        with self.assertRaisesRegex(ValueError, "Missing public file referenced"):
            prepare.check_references(self.root, prepare.public_files(self.root))
        (self.root / "index.html").unlink()
        with self.assertRaisesRegex(ValueError, "missing or empty"):
            prepare.public_files(self.root)

    def test_missing_required_manifest_entry_is_rejected(self):
        (self.root / "deployment/public-files.txt").write_text("index.html\nmissing.html\n")
        with self.assertRaisesRegex(ValueError, "missing from Git"):
            prepare.public_files(self.root)


class DestinationTests(unittest.TestCase):
    def validate(self, entries):
        client = deploy.SFTP("/tmp")
        client.run = lambda *args, **kwargs: ""
        client.listings = lambda paths: {p: entries[p] for p in paths}
        with redirect_stdout(io.StringIO()):
            client.validate_destination(["index.html", "images/photo.jpg"])

    def test_existing_destination_with_new_directories(self):
        self.validate({"/": {"mainsite/"}, "/mainsite": {"index.html", "uploads/", "unrelated@"}})

    def test_missing_or_symlinked_destination_is_rejected(self):
        for entries in [set(), {"mainsite@"}]:
            with self.subTest(entries=entries), self.assertRaisesRegex(ValueError, "must already exist"):
                self.validate({"/": entries})

    def test_remote_directory_symlink_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "remote symlink"):
            self.validate({"/": {"mainsite/"}, "/mainsite": {"images@"}})

    def test_remote_file_symlink_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "remote symlink"):
            self.validate({"/": {"mainsite/"}, "/mainsite": {"images/"},
                           "/mainsite/images": {"photo.jpg@"}})

    def test_file_directory_conflicts_are_rejected(self):
        for entries in [{"images"}, {"index.html/"}]:
            with self.subTest(entries=entries), self.assertRaisesRegex(ValueError, "blocks"):
                self.validate({"/": {"mainsite/"}, "/mainsite": entries})

    def test_non_production_manual_run_is_rejected_before_sftp(self):
        with patch.dict(os.environ, {"GITHUB_ACTIONS": "true", "GITHUB_REF": "refs/heads/feature",
                                    "GITHUB_REPOSITORY": "mkneuffer/Matts-Site"}):
            with patch.object(sys, "argv", ["deploy_ionos.py", "--deploy"]):
                with self.assertRaisesRegex(ValueError, "restricted"):
                    deploy.main()

    def test_authentication_error_is_clear_and_password_is_redacted(self):
        with patch.dict(os.environ, {"LFTP_PASSWORD": "example-test-password"}):
            client = deploy.SFTP("/tmp")
            result = subprocess.CompletedProcess(["lftp"], 1, "", "Login failed: example-test-password")
            with patch.object(deploy.subprocess, "run", return_value=result):
                with self.assertRaisesRegex(ValueError, "Login failed: \\[REDACTED\\]"):
                    client.run("pwd", "SFTP authentication")


@unittest.skipUnless(shutil.which("lftp"), "Local lftp integration requires lftp")
class LftpIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="ionos-lftp-test-")
        self.root = Path(self.temporary.name)
        self.source = self.root / "site"
        self.remote = self.root / "mainsite"
        self.source.mkdir()
        self.remote.mkdir()
        (self.source / "index.html").write_text("initial page")
        (self.source / ".htaccess").write_text("DirectoryIndex index.html")
        (self.source / "images").mkdir()
        (self.source / "images/photo with spaces.jpg").write_bytes(b"photo")
        (self.remote / "server-managed.txt").write_text("preserve")
        os.environ["LFTP_PASSWORD"] = "non-secret-test-value"
        self.client = deploy.SFTP(str(self.root))
        # Exercise real lftp's mirror/listing parser using its local-file transport.
        # These tests do not claim to verify production SSH or password authentication.
        self.client.settings = "set cmd:fail-exit yes\nset color:use-color no\nopen file:///"
        self.constants = patch.multiple(deploy, SOURCE=self.source, DESTINATION=str(self.remote))
        self.constants.start()

    def tearDown(self):
        self.constants.stop()
        self.temporary.cleanup()
        os.environ.pop("LFTP_PASSWORD", None)

    def test_genuine_dry_run_does_not_create_files_or_directories(self):
        before = {p.relative_to(self.remote) for p in self.remote.rglob("*")}
        output = self.client.mirror(dry_run=True)
        self.assertIn("index.html", output)
        self.assertEqual(before, {p.relative_to(self.remote) for p in self.remote.rglob("*")})
        self.assertEqual((self.remote / "server-managed.txt").read_text(), "preserve")

    def test_live_mirror_repeat_and_older_rollback_preserve_remote_files(self):
        self.client.mirror(dry_run=False)
        self.assertEqual((self.remote / "index.html").read_bytes(), (self.source / "index.html").read_bytes())
        self.assertTrue((self.remote / ".htaccess").is_file())
        self.assertTrue((self.remote / "images/photo with spaces.jpg").is_file())
        self.assertFalse((self.remote / "site").exists())
        self.assertNotIn("Transferring file", self.client.mirror(dry_run=True))
        (self.source / "index.html").write_text("rollback")
        os.utime(self.source / "index.html", (1000000000, 1000000000))
        self.client.mirror(dry_run=False)
        self.assertEqual((self.remote / "index.html").read_text(), "rollback")
        self.assertEqual((self.remote / "server-managed.txt").read_text(), "preserve")

    def test_listing_classifies_symlinks_and_keeps_spaces_and_dotfiles(self):
        (self.remote / "linked").symlink_to(self.remote / "server-managed.txt")
        (self.remote / ".htaccess").write_text("config")
        (self.remote / "file with spaces.pdf").write_text("resume")
        entries = self.client.listings([str(self.remote)])[str(self.remote)]
        self.assertIn("linked@", entries)
        self.assertIn(".htaccess", entries)
        self.assertIn("file with spaces.pdf", entries)

    def test_read_back_hash_mismatch_fails(self):
        self.client.mirror(dry_run=False)
        (self.remote / "index.html").write_text("unexpected remote contents")
        with patch.object(deploy, "REPRESENTATIVE_FILES", ["index.html"]):
            with self.assertRaisesRegex(ValueError, "does not match"):
                self.client.verify_files()


if __name__ == "__main__":
    unittest.main()
