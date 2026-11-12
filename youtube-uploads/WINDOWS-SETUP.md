# Windows setup — actually getting the videos live

Follow this top to bottom. ~15 minutes once. After that, uploading is two commands.

> **Known trap:** `npm install` in the repo root **fails on Windows**. One dependency
> (`sqlite3`) needs a C++ compiler, and the repo's agent code pulls it in even though the
> uploader never uses it. So we install **one package only** (`googleapis`) and use a
> standalone uploader (`scripts/yt-upload.js`) that ignores the rest of the repo.

---

## Step 0 — open PowerShell in the right folder

```powershell
cd C:\path\to\youtube-automation-agent
```

If you cloned it elsewhere, `cd` there. Confirm you see `scripts` and `youtube-uploads`:

```powershell
dir
```

**Check Node is there.** Node 18 or newer:

```powershell
node -v
```

If that errors, install Node LTS from <https://nodejs.org> and **reopen PowerShell**.

---

## Step 1 — install just `googleapis`

```powershell
npm i --no-save googleapis
```

Takes ~1–2 minutes, downloads ~220 MB, **no compiler needed**.

If you see `gyp` / `node-gyp` / `MSBuild` errors, you ran plain `npm install` — stop that and
run the exact command above instead.

Verify:

```powershell
node -e "const{google}=require('googleapis');console.log('ok',typeof google.youtube)"
```

Should print `ok function`.

---

## Step 2 — get a Google OAuth client (browser work, 5 min)

1. Go to <https://console.cloud.google.com> and sign in with the account that owns the channel.
2. Top bar → project dropdown → **New project** → name it anything (`youtube-upload`) → Create.
   Make sure the new project is selected afterwards.
3. Left menu → **APIs & Services → Library** → search **YouTube Data API v3** → **Enable**.
4. Left menu → **OAuth consent screen**
   - User type: **External** → Create
   - App name: `YouTube Upload`, your email in both email fields → Save and continue
   - Scopes: skip (just Save/Continue)
   - **Test users → Add users → add your own Gmail** → Save
   - ⚠️ Do not skip adding yourself as a test user or Step 3 fails with `access_denied`.
5. Left menu → **Credentials → Create credentials → OAuth client ID**
   - Application type: **Desktop app** → Create
   - **Download JSON**

The downloaded file is named something like `client_secret_1234-abcd.apps.googleusercontent.com.json`.

---

## Step 3 — put the file where the uploader expects it

The uploader wants it at `config\client_secret.json`. Rename it while copying:

```powershell
mkdir config -Force
Copy-Item "$env:USERPROFILE\Downloads\client_secret_*.json" config\client_secret.json
```

Check it landed:

```powershell
dir config
```

You should see **both** `client_secret.json` and `credentials.example.json`. `tokens.json` / `yt-auth.json`
do not exist yet — that is correct, Step 4 creates it.

---

## Step 4 — authorise the channel

```powershell
node scripts\yt-upload.js --setup
```

What happens:

1. It prints a long `https://accounts.google.com/o/oauth2/...` URL.
2. **Ctrl+click** it (or copy into your browser).
3. Choose the Google account that owns the YouTube channel.
4. You will see **"Google hasn't verified this app"** — this is expected for your own OAuth client.
   Click **Advanced → Go to YouTube Upload (unsafe)**.
5. Tick the permissions → **Continue**. The browser says *"Done — you can close this tab"*.
6. Back in PowerShell:

```
Saved config\yt-auth.json
Connected to: <your channel name>
  channel id: UC...
  subscribers: 0
  videos: 0
```

**That last block is the proof it worked.** If the channel name is wrong, you approved the wrong
Google account — delete `config\yt-auth.json` and re-run Step 4.

---

## Step 5 — check what the channel looks like right now

```powershell
node scripts\yt-upload.js --check
```

Prints your channel name, sub count, video count, and your last 10 uploads. This is the "is it real"
test — the `videos:` number is how many videos YouTube says you have.

---

## Step 6 — dry run (nothing uploads)

```powershell
node scripts\yt-upload.js --dry-run --manifest youtube-uploads\manifest.json
```

Expect four blocks with title, publish date, and a Drive file id, each ending `DRY RUN — skipped`.

If you instead see `googleapis is not installed`, redo Step 1.

---

## Step 7 — upload Batch 1

```powershell
node scripts\yt-upload.js --publish --manifest youtube-uploads\manifest.json
```

For each of the four:

```
  the-last-chai
      fetching from Drive (109uhDZ...) ...
      41.2 MB saved
      uploading 41.2 MB ...
      20%
      40%
      video: https://youtu.be/xxxxxxxxxxx
      thumbnail 16:9: set
      thumbnail 9:16: refused — ...
      DONE — scheduled, will go public automatically
```

Notes:

- Videos upload as **private** with a scheduled `publishAt`. They go public on their own;
  you do **not** have to be online at 7:30 PM.
- `thumbnail refused` is normal on Shorts. Open the video in YouTube Studio → thumbnail → upload
  `youtube-uploads\packs\<slug>_9x16.jpg`. 20 seconds each.
- A re-run skips anything already uploaded (tracked in `youtube-uploads\publish-ledger.json`).

Batch 2 any time before 17 Nov:

```powershell
node scripts\yt-upload.js --publish --manifest youtube-uploads\manifest-batch2.json
```

---

## Step 8 — confirm on YouTube

```powershell
node scripts\yt-upload.js --check
```

`videos:` should now be 4 (or 8). Then open <https://studio.youtube.com> → **Content** → you should
see them with a "Scheduled" status and the right dates.

---

## Troubleshooting

| Message | Cause | Fix |
|---|---|---|
| `MSBuild` / `node-gyp` / `gyp ERR!` | ran full `npm install` | use `npm i --no-save googleapis` |
| `googleapis is not installed` | Step 1 not done | run Step 1 |
| `Missing config\client_secret.json` | file not copied / wrong name | redo Step 3, check `dir config` |
| `Error 403: access_denied` | your email not in Test users | Step 2.4 — add yourself |
| `Error 400: redirect_uri_mismatch` | OAuth client is not "Desktop app" | delete the client, create a Desktop app one |
| `Error 403: youtubeSignupRequired` | Google account has no channel | create a channel on that account, redo Step 4 |
| `The request is missing a valid API key` | YouTube Data API v3 not enabled | Step 2.3 |
| `Drive returned a stub` / `probably private` | Drive file is private | right-click the file → Share → Anyone with the link |
| `quotaExceeded` | 6 uploads/day limit on a fresh project | wait until midnight Pacific, or split batches across days |
| Upload stalls at 0% | corporate proxy / VPN | disconnect VPN, retry |

---

## Two things to do before you publish

1. **Music rights.** If the BGM is not yours or AI-generated, a claim can land after the video is
   public. Check the track once; it is the only thing that can undo a good launch.
2. **`config\yt-auth.json` is a password.** It gives full upload access to your channel. Never commit
   it, never paste it in a chat. If it leaks: <https://myaccount.google.com/permissions> → remove access.

`.gitignore` already excludes `config/`, so it will not be pushed by accident. Verify with:

```powershell
git status
```

`config\yt-auth.json` must **not** appear in the list.
