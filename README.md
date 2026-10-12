# Matthew Neuffer's portfolio

This is a buildless HTML/CSS/JavaScript website. Public files are listed in
`deployment/public-files.txt`; there is no Node server, package installation, or
production compilation. The public site is https://matthewneuffer.com/.

## IONOS deployment

Pushes and merged pull requests to **`main`** run
[Deploy to IONOS](https://github.com/mkneuffer/Matts-Site/actions/workflows/deploy-ionos.yml)
on GitHub's Ubuntu runners. The workflow stages tracked public files in
**`.deploy/site/`**, verifies SFTP access and destination paths, prints a no-write
preview, and uploads that directory's **contents directly into `/mainsite/`**.
Your computer is not needed. Manual runs from other branches are skipped.

| Setting | Value |
| --- | --- |
| Protocol | SFTP over SSH, password authentication |
| Host | `home677718046.1and1-data.host` |
| User | `u88981197` |
| Port | `22` |
| SFTP-visible destination | `/mainsite/` (must already exist) |
| Required repository Actions secret | `IONOS_SFTP_PASSWORD` |
| Pinned SSH key | `deployment/ionos_known_hosts` |

Enter the password at [Settings → Secrets and variables → Actions → New repository secret](https://github.com/mkneuffer/Matts-Site/settings/secrets/actions).
Use the exact secret name **`IONOS_SFTP_PASSWORD`**. Do not put the password in
Git, workflow inputs, commands, or artifacts. The workflow passes it only to the
deployment step as `LFTP_PASSWORD`; lftp uses `--env-password` with tracing off.

The committed ED25519 key was fetched from this host on 2026-10-12 and its
SHA-256 fingerprint matched [IONOS's published webhosting fingerprints](https://www.ionos.de/hilfe/hosting/ssh-zugaenge-einrichten-und-verwalten/uebersicht-der-ssh-fingerabdruecke-im-ionos-webhosting/):
`SHA256:1gx2w8Rtv3wCgi7Jh8myf/KVd72cRQbow03UP8P095Q`.
SSH requires that pinned key; no per-run key scan or automatic acceptance is used.
If IONOS rotates keys, verify the replacement through IONOS before updating both
the known-hosts entry and the expected fingerprint in `scripts/deploy_ionos.py`.
No additional `IONOS_SSH_KNOWN_HOSTS` secret is needed with this verified pin.

### Manual preview and deployment

1. Open **Actions → Deploy to IONOS → Run workflow**.
2. Select branch **`main`**.
3. Leave **mode = `dry-run`** to validate authentication, host identity, paths,
   and planned transfers without any remote writes (the default).
4. Select **mode = `deploy`** for a real upload. A fresh no-write preview must
   pass before the upload begins.

After uploading, the script downloads five representative files (HTML, CSS,
JavaScript, an image, and the résumé PDF) into temporary local storage and checks
their SHA-256 hashes against the staged source. A successful SFTP transfer does
not itself verify HTTP routing or external dependencies; check the public site
separately when diagnosing domain or browser issues.

### Files, failures, and repeat deployments

The manifest includes the site pages, browser scripts, styles, images, and résumé
PDFs. Optional tracked `.htaccess`, `robots.txt`, `sitemap.xml`, and `favicon.ico`
are included when present. Git metadata, workflows, documentation, scripts,
private dotfiles, untracked files, and development dependencies are excluded.
Update the manifest deliberately when adding new public directories or server
files; PHP files would need an explicit manifest entry.

Uploads replace files at public paths owned by this repository. **Stale files
and all other remote files are preserved; there is no remote deletion or stale
cleanup.** Keep server-managed uploads and configuration outside the public
paths in the manifest. Symlinks and file/directory conflicts at deployment paths
are rejected before writing. `/mainsite/` is never created automatically.

Stable per-file Git timestamps let lftp skip unchanged files; older files may
replace newer ones to support rollback. Transfers run with two parallel files,
bounded network retries and timeouts, and a workflow concurrency group for this
destination. An active deployment is allowed to finish. GitHub may replace an
older pending run with a newer pending run. Uploads are incremental, not an
atomic whole-site switch; a failed upload can leave a mixture of revisions.

Open the failed Actions run and inspect the **Stage** or **Verify connection**
step for the specific error. Fix missing secrets, access, path conflicts, or
connection problems, then use **Re-run failed jobs** or start a new manual run.
Changes to the script require a new run at the updated `main` revision; rerunning
an old run uses its original revision. Repeating an upload is safe and read-back
checks run again.

To disable automatic deployment, choose **Disable workflow** from the workflow
page's menu (this also disables manual runs), or remove the `push` trigger in
`.github/workflows/deploy-ionos.yml` to retain manual runs. Re-enable the workflow
from the same menu when ready.

To roll back, restore the public files from a known-good revision on a new
commit on `main`, preserving the deployment workflow and scripts; push that
commit through the normal review process. For example, restore the paths from
the manifest with `git restore --source=<known-good-sha> -- <public-paths>` and
commit the result, or revert the offending site commit. The new `main` push
redeploys automatically. Files absent from the restored revision remain on the
server because deployments do not delete remote files.

### Local validation

Python 3 and Git are sufficient to stage and validate the public files:

```sh
python3 scripts/prepare_site.py
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v
actionlint .github/workflows/deploy-ionos.yml
```

There are no application dependencies to install or lockfiles to resolve. Local
SFTP checks additionally require lftp and OpenSSH and a securely supplied
`LFTP_PASSWORD` environment variable. `python3 scripts/deploy_ionos.py` defaults
to no-write mode; `--deploy` explicitly enables uploads. Prefer GitHub Actions
for credential-dependent checks when the password exists only as a GitHub secret.
