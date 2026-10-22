// Copyright (C) 2026 Kenneth Rohde Christiansen
// SPDX-License-Identifier: Apache-2.0
//
// Builds the GitHub Pages site: docs/index.html is the View as a standalone page.
import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const src = (f) => fileURLToPath(new URL(`../src/${f}`, import.meta.url));
const out = (f) => fileURLToPath(new URL(`../docs/${f}`, import.meta.url));

await mkdir(out(''), { recursive: true });
await copyFile(src('view.html'), out('index.html'));
await copyFile(src('dev-polyfill.js'), out('dev-polyfill.js'));
console.log('wrote docs/index.html and docs/dev-polyfill.js');
