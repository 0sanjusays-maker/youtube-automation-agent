#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Publishes files that already live in Google Drive straight to YouTube.
 *
 *   node scripts/publish-from-drive.js --manifest youtube-uploads/manifest.json --dry-run
 *   node scripts/publish-from-drive.js --manifest youtube-uploads/manifest.json --slug the-last-chai
 *   node scripts/publish-from-drive.js --manifest youtube-uploads/manifest.json --all
 *
 * Flow per item: download from Drive (skipped when the file is already local) ->
 * videos.insert with metadata + scheduled publishAt -> thumbnail.set (16:9 and,
 * when YouTube accepts it, the 9:16 Shorts tile) -> captions.insert.
 *
 * Safety:
 *   - Dry runs by default never touch YouTube; pass --dry-run explicitly or use --publish.
 *   - Videos are scheduled private with publishAt; nothing goes live before that time.
 *   - Every action is appended to youtube-uploads/publish-ledger.json so a crash or a
 *     re-run resumes instead of uploading twice.
 *
 * Auth: uses the repo's own CredentialManager (config/credentials.json + config/tokens.json).
 * Run `npm run credentials:setup` first if the channel is not connected yet.
 */
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const readline = require('readline');

const REPO_ROOT = path.join(__dirname, '..');
const LEDGER_PATH = path.join(REPO_ROOT, 'youtube-uploads', 'publish-ledger.json');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) { args._.push(token); continue; }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { args[key] = next; i += 1; } else { args[key] = true; }
  }
  return args;
}

function log(message) {
  console.log(message);
}

function loadManifest(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const manifest = JSON.parse(raw);
  if (!Array.isArray(manifest.items) || !manifest.items.length) {
    throw new Error(`Manifest ${file} has no items`);
  }
  return manifest;
}

function loadLedger() {
  try {
    return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
  } catch {
    return { updatedAt: null, items: {} };
  }
}

async function saveLedger(ledger) {
  ledger.updatedAt = new Date().toISOString();
  await fsp.mkdir(path.dirname(LEDGER_PATH), { recursive: true });
  await fsp.writeFile(LEDGER_PATH, `${JSON.stringify(ledger, null, 2)}\n`, { mode: 0o600 });
}

function absolute(relativePath) {
  return path.isAbsolute(relativePath) ? relativePath : path.join(REPO_ROOT, relativePath);
}

function assertLocalFile(filePath, label) {
  const abs = absolute(filePath);
  if (!fs.existsSync(abs)) throw new Error(`${label} not found: ${abs}`);
  const size = fs.statSync(abs).size;
  if (!size) throw new Error(`${label} is empty: ${abs}`);
  return abs;
}

function assertThumbnail(filePath, maxBytes = 2 * 1024 * 1024) {
  const abs = assertLocalFile(filePath, 'Thumbnail');
  const size = fs.statSync(abs).size;
  if (size > maxBytes) {
    throw new Error(`Thumbnail ${path.basename(abs)} is ${(size / 1024 / 1024).toFixed(2)} MB; YouTube accepts up to 2 MB`);
  }
  return abs;
}

function validateMetadata(item) {
  const problems = [];
  if (!item.title || item.title.length > 100) problems.push('title must be 1-100 characters');
  if (!item.description || item.description.length > 5000) problems.push('description must be 1-5000 characters');
  const tagBytes = (item.tags || []).join(',').length;
  if (tagBytes > 450) problems.push(`tags are ${tagBytes} characters; YouTube allows 450`);
  if (!/^\d{1,3}$/.test(String(item.categoryId))) problems.push('categoryId must be numeric');
  if (!Date.parse(item.publishAt)) problems.push('publishAt must be an ISO timestamp');
  if (problems.length) throw new Error(`${item.slug}: ${problems.join('; ')}`);
}

async function downloadFromDrive(fileId, destination) {
  await fsp.mkdir(path.dirname(destination), { recursive: true });
  log(`      downloading from Drive (${fileId})...`);
  const url = `https://drive.google.com/uc?export=download&id=${fileId}`;
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Drive download failed: HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 1024) {
    throw new Error('Drive returned a stub instead of the video (large-file confirmation page). Download it manually or make the file link-shareable.');
  }
  await fsp.writeFile(destination, buffer);
  log(`      saved ${(buffer.length / 1024 / 1024).toFixed(1)} MB -> ${destination}`);
  return destination;
}

async function resolveVideoFile(item, args) {
  const local = item.localVideo ? absolute(item.localVideo) : null;
  if (local && fs.existsSync(local)) return local;
  if (item.driveFileId) {
    const target = local || path.join(REPO_ROOT, 'youtube-uploads', 'src', `${item.slug}.mp4`);
    if (fs.existsSync(target) && fs.statSync(target).size > 1024) return target;
    if (args.dryRun) return target;
    return downloadFromDrive(item.driveFileId, target);
  }
  throw new Error(`${item.slug}: no localVideo and no driveFileId`);
}

async function confirm(question) {
  if (!process.stdin.isTTY) {
    throw new Error('Refusing to publish without confirmation in a non-interactive shell. Re-run with --yes if you mean it.');
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise(resolve => rl.question(question, resolve));
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

async function uploadThumbnail(youtube, videoId, thumbPath, { shortTile, ledger, item }) {
  try {
    await youtube.thumbnails.set({ videoId, media: { body: fs.createReadStream(thumbPath) } });
    ledger.items[item.slug].thumbnail = { path: path.basename(thumbPath), accepted: true, shortTile };
    log(`      thumbnail set: ${path.basename(thumbPath)}`);
  } catch (error) {
    // YouTube still refuses custom thumbnails on some Shorts. Leave the 16:9 in place and
    // tell the operator to set the 9:16 tile by hand in Studio if it matters.
    ledger.items[item.slug].thumbnail = { path: path.basename(thumbPath), accepted: false, shortTile, error: error.message };
    log(`      thumbnail rejected (${error.message.split('\n')[0]})`);
  }
}

async function uploadCaptions(youtube, videoId, item, ledger) {
  if (!item.captions) return;
  try {
    const file = assertLocalFile(item.captions, 'Captions');
    await youtube.captions.insert({
      part: 'snippet',
      requestBody: {
        snippet: {
          videoId,
          language: item.captionsLanguage || 'hi',
          name: item.captionsName || 'Hindi',
          isDraft: false
        }
      },
      media: { body: fs.createReadStream(file) }
    });
    ledger.items[item.slug].captions = { path: path.basename(file), language: item.captionsLanguage || 'hi', accepted: true };
    log(`      captions uploaded (${item.captionsLanguage || 'hi'})`);
  } catch (error) {
    ledger.items[item.slug].captions = { accepted: false, error: error.message };
    log(`      captions failed (${error.message.split('\n')[0]}) - upload them in Studio`);
  }
}

async function publishItem(youtube, item, args, ledger) {
  const state = ledger.items[item.slug] || (ledger.items[item.slug] = {});
  if (state.videoId && !args.force) {
    log(`      already published as ${state.videoId} - skipping (use --force to redo)`);
    return state;
  }

  validateMetadata(item);
  const thumb169 = assertThumbnail(item.thumbnail16x9);
  const thumb916 = item.thumbnail9x16 ? assertThumbnail(item.thumbnail9x16) : null;
  if (args.dryRun) {
    // No download in a dry run: report the intended source instead.
    log(`      video: ${item.localVideo || `Drive ${item.driveFileId} (${item.driveFileName})`}`);
  }
  const videoPath = await resolveVideoFile(item, args);
  const sizeMb = fs.existsSync(videoPath) ? fs.statSync(videoPath).size / 1024 / 1024 : null;
  if (sizeMb !== null) log(`      video: ${path.basename(videoPath)} (${sizeMb.toFixed(1)} MB)`);
  log(`      title: ${item.title}`);
  log(`      goes live: ${item.publishAtLocal || item.publishAt}`);
  log(`      thumbnails: 16:9 + ${thumb916 ? '9:16 tile' : 'none'}`);

  if (args.dryRun) {
    state.dryRunAt = new Date().toISOString();
    state.ready = true;
    log('      DRY RUN - nothing uploaded');
    return state;
  }

  const response = await youtube.videos.insert({
    part: 'snippet,status',
    requestBody: {
      snippet: {
        title: item.title,
        description: item.description,
        tags: item.tags || [],
        categoryId: String(item.categoryId),
        defaultLanguage: item.defaultLanguage || 'hi',
        defaultAudioLanguage: item.defaultAudioLanguage || 'hi'
      },
      status: {
        privacyStatus: 'private',
        publishAt: item.publishAt,
        selfDeclaredMadeForKids: false,
        containsSyntheticMedia: item.containsSyntheticMedia !== false
      }
    },
    media: { mimeType: 'video/mp4', body: fs.createReadStream(videoPath) }
  });

  state.videoId = response.data.id;
  state.youtubeUrl = `https://youtube.com/shorts/${state.videoId}`;
  state.studioUrl = `https://studio.youtube.com/video/${state.videoId}/edit`;
  state.publishAt = item.publishAt;
  state.uploadedAt = new Date().toISOString();
  await saveLedger(ledger);
  log(`      uploaded: ${state.youtubeUrl}`);

  await uploadThumbnail(youtube, state.videoId, thumb169, { shortTile: false, ledger, item });
  if (thumb916) {
    await uploadThumbnail(youtube, state.videoId, thumb916, { shortTile: true, ledger, item });
  }
  await uploadCaptions(youtube, state.videoId, item, ledger);
  await saveLedger(ledger);
  return state;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestPath = absolute(args.manifest || path.join('youtube-uploads', 'manifest.json'));
  const manifest = loadManifest(manifestPath);
  const dryRun = !args.publish;
  const ledger = loadLedger();

  let items = manifest.items;
  if (args.slug) items = items.filter(item => item.slug === args.slug);
  if (!items.length) throw new Error(`No manifest item matches --slug ${args.slug}`);

  log(`Manifest: ${manifestPath}`);
  log(`Mode: ${dryRun ? 'DRY RUN (no YouTube writes)' : 'PUBLISH'}`);
  log(`Items: ${items.map(item => item.slug).join(', ')}`);
  log('');

  let youtube = null;
  if (!dryRun) {
    const { CredentialManager } = require('../utils/credential-manager');
    const credentials = new CredentialManager();
    const ready = await credentials.initialize();
    if (!ready) throw new Error('Run npm run credentials:setup first - no YouTube credentials found in config/');
    youtube = credentials.getYouTubeClient();
    if (args.yes !== true) {
      const ok = await confirm(`Upload ${items.length} video(s) to YouTube, scheduled private? [y/N] `);
      if (!ok) { log('Aborted.'); return; }
    }
  }

  for (const item of items) {
    log(`  ${item.slug}`);
    try {
      await publishItem(youtube, item, { ...args, dryRun }, ledger);
    } catch (error) {
      ledger.items[item.slug] = { ...(ledger.items[item.slug] || {}), error: error.message, failedAt: new Date().toISOString() };
      await saveLedger(ledger);
      log(`      FAILED: ${error.message}`);
      if (!args.keepGoing) throw error;
    }
    log('');
  }

  ledger.batch = { items: items.map(item => item.slug), dryRun, finishedAt: new Date().toISOString() };
  await saveLedger(ledger);
  log(`Ledger: ${path.relative(REPO_ROOT, LEDGER_PATH)}`);
  if (dryRun) log('Dry run complete. Re-run with --publish (and --yes) to upload.');
}

if (require.main === module) {
  main().catch(error => {
    console.error(`\n${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { loadManifest, validateMetadata, parseArgs };
