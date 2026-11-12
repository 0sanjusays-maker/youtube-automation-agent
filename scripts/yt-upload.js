#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Standalone Drive -> YouTube uploader. Zero repo dependencies besides googleapis.
 *
 * Written for Windows, where `npm install` in the repo root fails on sqlite3
 * (needs a native build). This file talks to Google directly and touches no
 * agent code, no database, no LLM client.
 *
 *   node scripts/yt-upload.js --setup
 *   node scripts/yt-upload.js --check
 *   node scripts/yt-upload.js --dry-run --manifest ../youtube-uploads/manifest.json
 *   node scripts/yt-upload.js --publish --manifest ../youtube-uploads/manifest.json
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const REPO_ROOT = path.join(__dirname, '..');
const CONFIG_DIR = path.join(REPO_ROOT, 'config');
const AUTH_FILE = path.join(CONFIG_DIR, 'yt-auth.json');
const CLIENT_FILE = path.join(CONFIG_DIR, 'client_secret.json');
const LEDGER_PATH = path.join(REPO_ROOT, 'youtube-uploads', 'publish-ledger.json');

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.force-ssl'
];

function log(msg) { console.log(msg); }
function fail(msg) { console.error(`\n${msg}`); process.exit(1); }

function parseArgs(argv) {
  const args = { dryRun: true, mode: 'run' };
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === '--setup') args.mode = 'setup';
    else if (t === '--check') args.mode = 'check';
    else if (t === '--manifest') args.manifest = argv[++i];
    else if (t === '--slug') args.slug = argv[++i];
    else if (t === '--publish') args.dryRun = false;
    else if (t === '--dry-run') args.dryRun = true;
    else if (t === '--all') args.all = true;
  }
  return args;
}

function abs(p) { return path.isAbsolute(p) ? p : path.join(REPO_ROOT, p); }

/* ---------------------------------------------------------------- setup --- */

async function runSetup() {
  const { google } = require('googleapis');
  const readline = require('readline');

  if (!fs.existsSync(CLIENT_FILE)) {
    log(`\nMissing ${path.relative(REPO_ROOT, CLIENT_FILE)}`);
    log('\nDo this first:');
    log('  1. https://console.cloud.google.com -> create a project');
    log('  2. APIs & Services -> Library -> "YouTube Data API v3" -> Enable');
    log('  3. OAuth consent screen -> External -> add your own email under Test users');
    log('  4. Credentials -> Create credentials -> OAuth client ID -> Desktop app');
    log('  5. Download the JSON and save it as:');
    log(`     ${CLIENT_FILE}`);
    log('\nThen run: node scripts/yt-upload.js --setup');
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(CLIENT_FILE, 'utf8'));
  // Google's download wraps the values in "installed" (or "web") - accept both.
  const inner = raw.installed || raw.web || raw;
  if (!inner.client_id || !inner.client_secret) {
    fail(`${path.relative(REPO_ROOT, CLIENT_FILE)} has no client_id/client_secret. Re-download a Desktop app OAuth client.`);
  }

  const client = new google.auth.OAuth2(inner.client_id, inner.client_secret, 'http://127.0.0.1:4242/oauth2callback');
  const url = client.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES });

  log('\nOpen this URL in your browser and approve access for the channel you want to upload to:\n');
  log(url);
  log('\nWaiting for the browser to come back on http://127.0.0.1:4242 ...');

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1:4242');
      if (u.pathname !== '/oauth2callback') { res.writeHead(404).end(); return; }
      const err = u.searchParams.get('error');
      const c = u.searchParams.get('code');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<html><body style="font-family:system-ui;padding:40px">
        <h2>${err ? 'Authorisation failed' : 'Done — you can close this tab'}</h2>
        <p>${err ? err : 'Token saved. Go back to the terminal.'}</p></body></html>`);
      server.close();
      if (err) reject(new Error(err)); else resolve(c);
    });
    server.on('error', reject);
    server.listen(4242, '127.0.0.1');
  });

  const { tokens } = await client.getToken(code);
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ ...inner, ...tokens }, null, 2), { mode: 0o600 });
  log(`\nSaved ${path.relative(REPO_ROOT, AUTH_FILE)}`);

  client.setCredentials(tokens);
  const youtube = google.youtube({ version: 'v3', auth: client });
  const me = await youtube.channels.list({ part: 'snippet,statistics', mine: true });
  const ch = (me.data.items || [])[0];
  if (!ch) fail('Authorised, but this Google account has no YouTube channel. Create one, then re-run --setup.');
  log(`\nConnected to: ${ch.snippet.title}`);
  log(`  channel id: ${ch.id}`);
  log(`  subscribers: ${ch.statistics.subscriberCount}`);
  log(`  videos: ${ch.statistics.videoCount}`);
  log('\nNext: node scripts/yt-upload.js --check');
}

/* ---------------------------------------------------------------- auth --- */

function buildClient() {
  const { google } = require('googleapis');
  if (!fs.existsSync(AUTH_FILE)) {
    fail(`No ${path.relative(REPO_ROOT, AUTH_FILE)}.\nRun: node scripts/yt-upload.js --setup`);
  }
  const saved = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
  const client = new google.auth.OAuth2(saved.client_id, saved.client_secret, 'http://127.0.0.1:4242/oauth2callback');
  client.setCredentials(saved);

  // Persist a refreshed access token so the next run is instant.
  client.on('tokens', fresh => {
    const merged = { ...saved, ...fresh };
    fs.writeFileSync(AUTH_FILE, JSON.stringify(merged, null, 2), { mode: 0o600 });
  });
  return client;
}

async function runCheck() {
  const { google } = require('googleapis');
  const auth = buildClient();
  const youtube = google.youtube({ version: 'v3', auth });
  const me = await youtube.channels.list({ part: 'snippet,statistics,contentDetails', mine: true });
  const ch = (me.data.items || [])[0];
  if (!ch) fail('This credential has no channel.');
  log(`Channel: ${ch.snippet.title} (${ch.id})`);
  log(`Subscribers: ${ch.statistics.subscriberCount}   Videos: ${ch.statistics.videoCount}`);

  const uploads = ch.contentDetails && ch.contentDetails.relatedPlaylists
    ? ch.contentDetails.relatedPlaylists.uploads : null;
  if (uploads) {
    const list = await youtube.playlistItems.list({ part: 'snippet', playlistId: uploads, maxResults: 10 });
    const items = list.data.items || [];
    log(`\nLast ${items.length} upload(s) on the channel:`);
    if (!items.length) log('  (none)');
    for (const it of items) log(`  ${it.snippet.publishedAt.slice(0, 10)}  ${it.snippet.title}`);
  }
  log('\nAuth works. Next: --dry-run, then --publish.');
}

/* -------------------------------------------------------------- uploads --- */

function loadLedger() {
  try { return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8')); }
  catch { return { items: {} }; }
}

function saveLedger(l) {
  l.updatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(LEDGER_PATH), { recursive: true });
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(l, null, 2));
}

/**
 * Drive download that handles the "cannot scan for viruses" interstitial that
 * Google serves for files above ~100 MB.
 */
async function downloadFromDrive(fileId, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  log(`      fetching from Drive (${fileId}) ...`);
  const base = 'https://drive.google.com/uc?export=download';
  let res = await fetch(`${base}&id=${fileId}`, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Drive returned HTTP ${res.status}`);

  let buf = Buffer.from(await res.arrayBuffer());
  const isHtml = buf.slice(0, 200).toString('utf8').toLowerCase().includes('<html');
  if (isHtml) {
    const html = buf.toString('utf8');
    const tokenMatch = html.match(/confirm=([0-9A-Za-z_-]+)/) || html.match(/name="confirm" value="([^"]+)"/);
    if (!tokenMatch) {
      throw new Error('Drive served a confirmation page with no token. Set the file to "Anyone with the link", or download it manually.');
    }
    log('      large file — following Drive confirmation token ...');
    res = await fetch(`${base}&id=${fileId}&confirm=${tokenMatch[1]}`, { redirect: 'follow' });
    if (!res.ok) throw new Error(`Drive confirm step returned HTTP ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
  }
  if (buf.length < 1024) throw new Error('Drive returned a stub. The file is probably private — share it as "Anyone with the link".');
  fs.writeFileSync(destination, buf);
  log(`      ${(buf.length / 1024 / 1024).toFixed(1)} MB saved`);
  return destination;
}

async function uploadOne(youtube, item, source) {
  const status = {
    privacyStatus: 'private',
    publishAt: new Date(item.publishAt).toISOString(),
    selfDeclaredMadeForKids: false
  };
  if (item.containsSyntheticMedia !== false) status.containsSyntheticMedia = true;

  const requestBody = {
    snippet: {
      title: item.title,
      description: item.description,
      tags: item.tags,
      categoryId: item.categoryId,
      defaultLanguage: item.defaultLanguage || 'hi'
    },
    status
  };

  const size = fs.statSync(source).size;
  log(`      uploading ${(size / 1024 / 1024).toFixed(1)} MB ...`);

  const res = await youtube.videos.insert({
    part: 'snippet,status',
    requestBody,
    media: { body: fs.createReadStream(source) }
  }, {
    onUploadProgress: e => {
      if (!e.bytesRead) return;
      const pct = Math.floor((e.bytesRead / size) * 100);
      if (pct % 20 === 0) log(`      ${pct}%`);
    }
  });

  const videoId = res.data.id;
  log(`      video: https://youtu.be/${videoId}`);

  for (const [label, p] of [['16:9', item.thumbnail16x9], ['9:16', item.thumbnail9x16]]) {
    if (!p) continue;
    const file = abs(p);
    if (!fs.existsSync(file)) { log(`      thumbnail ${label}: not found locally (${p})`); continue; }
    try {
      await youtube.thumbnails.set({ videoId, media: { body: fs.createReadStream(file) } });
      log(`      thumbnail ${label}: set`);
    } catch (e) {
      log(`      thumbnail ${label}: refused — ${String(e.message).split('\n')[0]}`);
      log('        (YouTube often refuses custom thumbnails on Shorts; set it in Studio)');
    }
  }

  if (item.captions) {
    const srt = abs(item.captions);
    if (fs.existsSync(srt)) {
      try {
        await youtube.captions.insert({
          part: 'snippet',
          requestBody: { snippet: { videoId, language: item.captionsLanguage || 'hi', name: item.captionsName || 'Hindi' } },
          media: { body: fs.createReadStream(srt) }
        });
        log('      captions: attached');
      } catch (e) {
        log(`      captions: failed — ${String(e.message).split('\n')[0]}`);
      }
    }
  }
  return videoId;
}

async function runUpload(args) {
  const { google } = require('googleapis');
  const manifestPath = abs(args.manifest || 'youtube-uploads/manifest.json');
  if (!fs.existsSync(manifestPath)) fail(`Manifest not found: ${manifestPath}`);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  let items = manifest.items || [];
  if (args.slug) items = items.filter(i => i.slug === args.slug);
  if (!items.length) fail(`No item matches --slug ${args.slug}`);

  const ledger = loadLedger();
  const pending = items.filter(i => {
    const done = ledger.items[i.slug] && ledger.items[i.slug].videoId;
    if (done) log(`  ${i.slug}: already uploaded (${ledger.items[i.slug].videoId}) — skipping`);
    return !done || args.all;
  });

  log(`\nManifest: ${path.relative(REPO_ROOT, manifestPath)}`);
  log(`Mode: ${args.dryRun ? 'DRY RUN — nothing will be uploaded' : 'PUBLISH'}`);
  log(`Items: ${pending.map(i => i.slug).join(', ') || '(none)'}\n`);

  if (!pending.length) { log('Nothing to do.'); return; }

  const youtube = args.dryRun ? null : google.youtube({ version: 'v3', auth: buildClient() });

  for (const item of pending) {
    log(`  ${item.slug}`);
    if (args.dryRun) {
      log(`      title: ${item.title}`);
      log(`      live:  ${new Date(item.publishAt).toISOString()}`);
      log(`      drive: ${item.driveFileId}`);
      log('      DRY RUN — skipped');
      log('');
      continue;
    }
    try {
      const src = path.join(REPO_ROOT, 'youtube-uploads', 'src', `${item.slug}.mp4`);
      if (!fs.existsSync(src) || fs.statSync(src).size < 1024) {
        await downloadFromDrive(item.driveFileId, src);
      } else {
        log(`      using existing download (${(fs.statSync(src).size / 1024 / 1024).toFixed(1)} MB)`);
      }
      const videoId = await uploadOne(youtube, item, src);
      ledger.items[item.slug] = { videoId, uploadedAt: new Date().toISOString(), publishAt: item.publishAt };
      saveLedger(ledger);
      log('      DONE — scheduled, will go public automatically\n');
    } catch (e) {
      ledger.items[item.slug] = { ...(ledger.items[item.slug] || {}), error: e.message, failedAt: new Date().toISOString() };
      saveLedger(ledger);
      log(`      FAILED: ${e.message}\n`);
      process.exitCode = 1;
    }
  }
}

/* ----------------------------------------------------------------- main --- */

async function main() {
  const args = parseArgs(process.argv.slice(2));
  try { require.resolve('googleapis'); }
  catch {
    fail('googleapis is not installed.\nRun:  npm i --no-save googleapis\n(that one package, not the whole repo — the repo install fails on sqlite3 on Windows)');
  }
  if (args.mode === 'setup') return runSetup();
  if (args.mode === 'check') return runCheck();
  return runUpload(args);
}

main().catch(e => fail(e.message));
