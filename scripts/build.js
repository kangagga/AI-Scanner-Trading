/**
 * Build/validation step for the control center.
 *
 * The app is plain HTML/CSS/ES-modules, so there is no bundler. This script
 * verifies that every runtime asset exists and that each JS module parses as
 * an ES module (`node --check`, honoring public/package.json "type":"module").
 *
 * Android APK: see docs/APK_BUILD.md (Capacitor wraps public/).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

const REQUIRED = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'css/app.css',
  'js/app.js',
  'js/core/api.js',
  'js/core/store.js',
  'js/core/format.js',
  'js/core/demo.js',
  'js/ui/shell.js',
  'js/ui/components.js',
  'js/ui/charts.js',
];

function listJs(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listJs(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

let failed = 0;

for (const rel of REQUIRED) {
  const full = path.join(PUBLIC, rel);
  if (!fs.existsSync(full)) {
    console.error(`MISSING  ${rel}`);
    failed += 1;
  } else {
    console.log(`ok       ${rel}`);
  }
}

const jsFiles = listJs(PUBLIC);
for (const file of jsFiles) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    const detail = String(err.stderr || err.message).split('\n').slice(0, 4).join(' ');
    console.error(`SYNTAX   ${path.relative(ROOT, file)}: ${detail}`);
    failed += 1;
  }
}

console.log(`\n${jsFiles.length} JS modules parsed, ${REQUIRED.length} required assets checked.`);

if (failed) {
  console.error(`\nBUILD FAILED — ${failed} problem(s).`);
  process.exit(1);
}

console.log('BUILD OK — control center is complete and ready to serve.');
console.log('Android APK: docs/APK_BUILD.md (needs Android SDK + Gradle).');
