#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Turns the repo's config/tokens.json into the one-line YT_OAUTH_TOKEN value
 * that the GitHub Actions workflow needs. Runs on the owner's machine after
 * `npm run credentials:setup`.
 *
 *   node scripts/print-oauth-token.js
 *
 * It prints the JSON to paste into GitHub repo secrets. Keep it private: a
 * refresh_token is as powerful as the account's YouTube access.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const credsPath = path.join(ROOT, 'config', 'credentials.json');
const tokensPath = path.join(ROOT, 'config', 'tokens.json');

function readJson(p, label) {
  if (!fs.existsSync(p)) {
    console.error(`Missing ${label}: ${path.relative(ROOT, p)}`);
    console.error('Run `npm run credentials:setup` first.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const creds = readJson(credsPath, 'credentials.json');
const tokens = readJson(tokensPath, 'tokens.json');

const yt = creds.youtube || {};
const tok = tokens.youtube || {};

if (!yt.client_id || !yt.client_secret) {
  console.error('credentials.json has no youtube.client_id / client_secret.');
  process.exit(1);
}
if (!tok.refresh_token) {
  console.error('tokens.json has no refresh_token. Re-run `npm run credentials:setup` and accept offline access.');
  process.exit(1);
}

const payload = {
  client_id: yt.client_id,
  client_secret: yt.client_secret,
  refresh_token: tok.refresh_token,
  redirect_uris: yt.redirect_uris || ['http://127.0.0.1']
};

console.log('\nCopy the single line below into GitHub -> Settings -> Secrets and variables -> Actions');
console.log('Name:  YT_OAUTH_TOKEN\n');
console.log(JSON.stringify(payload));
console.log('\nTreat it like a password. Delete it if you ever revoke access.');
