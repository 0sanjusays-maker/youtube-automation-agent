# How the videos actually get onto YouTube

Read this once. It is the difference between "the pack is ready" and "the videos are live".

## The honest situation

Everything in this folder is **prepared**, not published. 0 of the 8 videos are on YouTube.

Nothing can be uploaded from the agent sandbox, because:

- the sandbox has no route to `youtube.googleapis.com` / `oauth2.googleapis.com` (connections return `000`), and
- no YouTube credential exists yet — `config/` only holds `credentials.example.json`.

So the upload has to happen either **on your machine** or **from GitHub's servers**, and in both cases it needs a credential that only you can create.

---

## Option A — from your machine (fastest, 10 minutes)

### 1. Create an OAuth client

1. <https://console.cloud.google.com> → new project (any name).
2. **APIs & Services → Library → YouTube Data API v3 → Enable.**
3. **OAuth consent screen** → External → fill the two required fields → add your own Google account under **Test users**.
4. **Credentials → Create credentials → OAuth client ID → Desktop app.**
5. Download the JSON.

### 2. Install it

```bash
mv ~/Downloads/client_secret_*.json config/credentials.json
```

The file must look like this (the repo reads this shape, not Google's raw download):

```json
{
  "youtube": {
    "client_id": "xxxx.apps.googleusercontent.com",
    "client_secret": "GOCSPX-xxxx",
    "redirect_uris": ["http://127.0.0.1"]
  }
}
```

If your download is in Google's wrapped form (`{"installed": {...}}`), copy `client_id` and `client_secret` into the shape above.

### 3. Authorise

```bash
npm install
npm run credentials:setup
```

Pick **YouTube** when asked. It prints a URL, you approve it, paste the code back. `config/tokens.json` is written (mode 0600).

### 4. Upload

```bash
node scripts/publish-from-drive.js --manifest youtube-uploads/manifest.json --dry-run   # check
node scripts/publish-from-drive.js --manifest youtube-uploads/manifest.json --publish --yes
```

Then Batch 2 any time before 17 Nov:

```bash
node scripts/publish-from-drive.js --manifest youtube-uploads/manifest-batch2.json --publish --yes
```

---

## Option B — from GitHub Actions (set and forget)

This is the closest thing to "the agent uploads it": a job on GitHub's runner does the upload on a schedule, using a credential you paste once.

**One catch to know up front:** the Drive videos are downloaded through an unauthenticated
`drive.google.com/uc?export=download` link. In practice that returns a "can't scan this file"
confirmation page for anything over ~100 MB instead of the bytes. So for this path each video
needs to be **link-shared** and under that limit, or simply present in the repo under
`youtube-uploads/src/<slug>.mp4`. Check sizes first:

```bash
# in the uploader, before relying on it
node scripts/publish-oauth.js --manifest youtube-uploads/manifest.json --dry-run
```

### Setup

1. Do steps 1–3 of Option A once, on any machine.
2. Produce the secret value:

   ```bash
   node scripts/print-oauth-token.js
   ```

   It prints one JSON line containing `client_id`, `client_secret` and `refresh_token`.

3. GitHub → repo → **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `YT_OAUTH_TOKEN`
   - Value: the whole JSON line.

4. **Actions → Publish to YouTube → Run workflow**
   - manifest: `youtube-uploads/manifest.json`
   - dry_run: `true` (first run — proves auth works without uploading)
   - then run again with `dry_run: false`.

After that it runs daily at 15:00 IST, uploads only what is due and not already in the ledger,
and keeps the ledger as a workflow artifact.

### What the workflow does not do

- It does not set a custom thumbnail on Shorts if YouTube refuses it — it logs the refusal, and
  you set it in Studio. This is an API limitation, not a bug.
- It does not fix a Drive file that is private. A private Drive file cannot be fetched by the
  runner; link-share it or commit it.

---

## Which option should I use?

| | Option A (your machine) | Option B (GitHub Actions) |
|---|---|---|
| Setup time | ~10 min | ~20 min |
| Needs your laptop awake | yes, at upload time | no |
| Works with big Drive files | yes (OAuth download) | only if link-shared and < ~100 MB |
| Good for | getting Batch 1 out today | Batch 3+ and repeatable weekly uploads |

**Recommendation:** Option A once, today, to get Batch 1 live. Then Option B for everything after,
so future batches need no laptop at all.

---

## What I can and cannot do

| Task | Can the agent do it? |
|---|---|
| Pick and audit the videos | yes — done (31 files, 9 eligible) |
| Write titles, descriptions, tags, alt titles | yes — done |
| Render 9:16 + 16:9 thumbnails | yes — done (16 files) |
| Build the uploader and dry-run it | yes — done |
| Create your Google OAuth client | **no** — needs your Google login |
| Approve the consent screen | **no** — must be you |
| Hold your refresh token | **no** — should never happen |
| Run the upload | only on infra that has network + credential (your PC, or GitHub Actions) |
| Verify on YouTube after upload | **no** — no read access either |

Anything in the last four rows is a hand-off, not a task. That is why this document exists.
