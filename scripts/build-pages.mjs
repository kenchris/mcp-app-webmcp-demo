// Copyright (C) 2026 Kenneth Rohde Christiansen
// SPDX-License-Identifier: Apache-2.0
//
// Builds the GitHub Pages site: docs/index.html is the View as a standalone page, with the
// WebMCP origin trial token for https://kenchris.github.io (Chrome 149+; first-party, not
// subdomain; expires 2027-03-30, renew at https://developer.chrome.com/origintrials/).
// The token is only added here: the View a host loads (src/view.html) stays token-free.
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ORIGIN_TRIAL_TOKEN = 'AqwHZvI4RHAdSs9HJVPDQl8mNHQOFBU9eAFQYBNuUHsbpg5mtoYP5v6hFQ1zIRxTfV8tR2wsfUOjcLdL+X4CsQQAAABSeyJvcmlnaW4iOiJodHRwczovL2tlbmNocmlzLmdpdGh1Yi5pbzo0NDMiLCJmZWF0dXJlIjoiV2ViTUNQIiwiZXhwaXJ5IjoxODA2MzY0ODAwfQ==';

const src = (f) => fileURLToPath(new URL(`../src/${f}`, import.meta.url));
const out = (f) => fileURLToPath(new URL(`../docs/${f}`, import.meta.url));

await mkdir(out(''), { recursive: true });
const html = await readFile(src('view.html'), 'utf8');
if (!html.includes('<head>')) throw new Error('src/view.html has no <head>');
await writeFile(out('index.html'),
  html.replace('<head>', `<head>\n<meta http-equiv="origin-trial" content="${ORIGIN_TRIAL_TOKEN}">`));
await copyFile(src('dev-polyfill.js'), out('dev-polyfill.js'));
console.log('wrote docs/index.html and docs/dev-polyfill.js');
