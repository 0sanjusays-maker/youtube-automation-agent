#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Minimal Drive -> YouTube uploader for unattended runs (GitHub Actions).
 *
 * Unlike scripts/publish-from-drive.js this does NOT load the repo's
 * CredentialManager: that pulls in utils/ai-text-service.js -> `openai` ->
 * `sqlite3`, which needs a native build on the runner. Here auth comes from a
 * single JSON env var, so the only runtime dependency is googleapis.
 *
 *   YT_OAUTH_TOKEN='{"client_id":"...","client_secret":"...","refresh_token":"...","redirect_uris":["http://127.0.0.1"]}'
 *   node scripts/publish-oauth.js --manifest youtube-uploads/manifest.json
 *
 * Flags: --manifest <path>  --slug <slug>  --all  --dry-run  --publish
 */
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const LEDGER_PATH = path.join(REPO_ROOT, 'youtube-uploads', 'publish-ledger.json');

function log(msg) {
  console.log(msg);
}

function parseArgs(argv) {
  const args = { dryRun: true };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--manifest') args.manifest = argv[++i];
    else if (token === '--slug') args.slug = argv[++i];
    else if (token === '--publish') args.dryRun = false;
    else if (token === '--dry-run') args.dryRun = true;
    else if (token === '--all') args.all = true;
  }
  return args;
}

function absolute(p) {
  return path.isAbsolute(p) ? p : path.join(REPO_ROOT, p);
}

async function loadLedger() {
  try {
    return JSON.parse(await fsp.readFile(LEDGER_PATH, 'utf8'));
  } catch {
    return { items: {} };
  }
}

async function saveLedger(ledger) {
  ledger.updatedAt = new Date().toISOString();
  await fsp.mkdir(path.dirname(LEDGER_PATH), { recursive: true });
  await fsp.writeFile(LEDGER_PATH, JSON.stringify(ledger, null, 2));
}

function buildAuth() {
  const raw = process.env.YT_OAUTH_TOKEN;
  if (!raw) throw new Error('YT_OAUTH_TOKEN is not set (expected a JSON string with client_id, client_secret, refresh_token)');
  const parsed = JSON.parse(raw);
  if (!parsed.client_id || !parsed.client_secret || !parsed.refresh_token) {
    throw new Error('YT_OAUTH_TOKEN needs client_id, client_secret and refresh_token');
  }
  const { google } = require('googleapis');
  const oauth2 = new google.auth.OAuth2(
    parsed.client_id,
    parsed.client_secret,
    parsed.redirect_uris && parsed.redirect_uris[0]
  );
  oauth2.setCredentials({
    refresh_token: parsed.refresh_token,
    access_token: parsed.access_token,
    expiry_date: parsed.expiry_date
  });
  return oauth2;
}

async function downloadFromDrive(fileId, destination) {
  await fsp.mkdir(path.dirname(destination), { recursive: true });
  const url = `https://drive.google.com/uc?export=download&id=${fileId}`;
  log(`      downloading ${fileId}...`);
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Drive download failed: HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 1024) {
    throw new Error('Drive returned a stub (large-file confirmation page). Make the file link-shareable or upload it to the repo.');
  }
  await fsp.writeFile(destination, buffer);
  log(`      ${(buffer.length / 1024 / 1024).toFixed(1)} MB -> ${destination}`);
  return destination;
}

async function uploadItem(youtube, item, sourceFile) {
  const body = {
    snippet: {
      title: item.title,
      description: item.description,
      tags: item.tags,
      categoryId: item.categoryId,
      defaultLanguage: item.defaultLanguage || 'hi'
    },
    status: {
      privacyStatus: 'private',
      publishAt: new Date(item.publishAt).toISOString(),
      selfDeclaredMadeForKids: false
    }
  };
  if (item.containsSyntheticMedia) {
    // Altered/synthetic content disclosure (YouTube Data API v3, status.containsSyntheticMedia).
    body.status.containsSyntheticMedia = true;
  }

  const size = fs.statSync(sourceFile).size;
  log(`      uploading ${(size / 1024 / 1024).toFixed(1)} MB...`);

  const res = await youtube.videos.insert(
    {
      part: 'snippet,status',
      requestBody: body,
      media: { body: fs.createReadStream(sourceFile) }
    },
    {
      onUploadProgress: evt => {
        if (evt.bytesRead && size) {
          const pct = Math.round((evt.bytesRead / size) * 100);
          if (pct % 25 === 0) log(`      ${pct}%`);
        }
      }
    }
  );
  const videoId = res.data.id;
  log(`      video id ${videoId}`);

  for (const [kind, thumbPath] of [['16:9', item.thumbnail16x9], ['9:16', item.thumbnail9x16]]) {
    if (!thumbPath) continue;
    const abs = absolute(thumbPath);
    if (!fs.existsSync(abs)) {
      log(`      thumbnail ${kind}: missing locally (${thumbPath}) - set it in Studio`);
      continue;
    }
    try {
      await youtube.thumbnails.set({ videoId, media: { body: fs.createReadStream(abs) } });
      log(`      thumbnail ${kind}: set`);
    } catch (error) {
      log(`      thumbnail ${kind}: refused (${error.message.split('\n')[0]}) - set it in Studio`);
    }
  }

  if (item.captions) {
    const abs = absolute(item.captions);
    if (fs.existsSync(abs)) {
      try {
        await youtube.captions.insert({
          part: 'snippet',
          requestBody: { snippet: { videoId, language: item.captionsLanguage, name: item.captionsName } },
          media: { body: fs.createReadStream(abs) }
        });
        log('      captions: attached');
      } catch (error) {
        log(`      captions: failed (${error.message.split('\n')[0]}) - upload the SRT in Studio`);
      }
    } else {
      log(`      captions: file missing (${item.captions})`);
    }
  }

  return videoId;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestPath = absolute(args.manifest || 'youtube-uploads/manifest.json');
  const manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
  const ledger = await loadLedger();

  let items = manifest.items || [];
  if (args.slug) items = items.filter(item => item.slug === args.slug);
  if (!items.length) throw new Error(`No item matches --slug ${args.slug}`);

  const due = items.filter(item => {
    const done = ledger.items[item.slug] && ledger.items[item.slug].videoId;
    if (done) {
      log(`  ${item.slug}: already uploaded as ${ledger.items[item.slug].videoId} - skipping`);
      return false;
    }
    if (!args.all && Date.parse(item.publishAt) < Date.now() && Date.now() - Date.parse(item.publishAt) > 7 * 864e5) {
      log(`  ${item.slug}: slot is more than 7 days in the past - skipping`);
      return false;
    }
    return true;
  });

  log(`Manifest: ${path.relative(REPO_ROOT, manifestPath)}`);
  log(`Mode: ${args.dryRun ? 'DRY RUN (no YouTube writes)' : 'PUBLISH'}`);
  log(`Due: ${due.map(i => i.slug).join(', ') || '(nothing)'}`);
  log('');

  if (!due.length) {
    log('Nothing to do.');
    return;
  }

  let youtube = null;
  if (!args.dryRun) {
    const auth = buildAuth();
    const { google } = require('googleapis');
    youtube = google.youtube({ version: 'v3', auth });
  }

  for (const item of due) {
    log(`  ${item.slug}`);
    try {
      if (args.dryRun) {
        log(`      would upload ${item.title}`);
        log(`      goes live ${new Date(item.publishAt).toISOString()}`);
        log('      DRY RUN - nothing uploaded');
        continue;
      }
      const source = path.join(REPO_ROOT, 'youtube-uploads', 'src', `${item.slug}.mp4`);
      if (!fs.existsSync(source) || fs.statSync(source).size < 1024) {
        await downloadFromDrive(item.driveFileId, source);
      }
      const videoId = await uploadItem(youtube, item, source);
      ledger.items[item.slug] = { videoId, uploadedAt: new Date().toISOString(), publishAt: item.publishAt };
      await saveLedger(ledger);
      log('      DONE');
    } catch (error) {
      ledger.items[item.slug] = { ...(ledger.items[item.slug] || {}), error: error.message, failedAt: new Date().toISOString() };
      await saveLedger(ledger);
      log(`      FAILED: ${error.message}`);
      process.exitCode = 1;
    }
    log('');
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(`\n${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { parseArgs, buildAuth };
