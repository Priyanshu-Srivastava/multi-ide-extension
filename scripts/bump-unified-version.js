#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATHS = [
  path.join(ROOT, 'manifests', 'unified-vscode.json'),
  path.join(ROOT, 'manifests', 'unified-cursor.json'),
  path.join(ROOT, 'manifests', 'unified-jetbrains.json'),
];
const VALID_BUMPS = new Set(['patch', 'minor', 'major']);

function getArg(flag) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(flag);
  return i !== -1 ? argv[i + 1] : null;
}

function fail(message) {
  console.error(`\n[bump-unified-version] Error: ${message}`);
  process.exit(1);
}

const existingManifestPaths = MANIFEST_PATHS.filter((p) => fs.existsSync(p));
if (existingManifestPaths.length === 0) {
  fail(`No unified manifests found. Expected at least one of: ${MANIFEST_PATHS.join(', ')}`);
}

const bump = getArg('--bump') || 'patch';
if (!VALID_BUMPS.has(bump)) {
  fail(`Invalid --bump value: ${bump}. Expected patch|minor|major`);
}

const manifests = existingManifestPaths.map((p) => ({
  path: p,
  json: JSON.parse(fs.readFileSync(p, 'utf-8')),
}));

const primaryManifest = manifests.find((m) => m.path.endsWith('unified-vscode.json')) || manifests[0];
const current = primaryManifest.json.version || '0.0.0';
if (!/^\d+\.\d+\.\d+$/.test(current)) {
  fail(`Invalid current version in manifest: ${current}`);
}

for (const m of manifests) {
  const v = m.json.version || '0.0.0';
  if (!/^\d+\.\d+\.\d+$/.test(v)) {
    fail(`Invalid current version in manifest ${m.path}: ${v}`);
  }
}

let [major, minor, patch] = current.split('.').map(Number);
if (bump === 'major') {
  major += 1;
  minor = 0;
  patch = 0;
} else if (bump === 'minor') {
  minor += 1;
  patch = 0;
} else {
  patch += 1;
}

const next = `${major}.${minor}.${patch}`;
for (const m of manifests) {
  m.json.version = next;
  fs.writeFileSync(m.path, JSON.stringify(m.json, null, 2) + '\n', 'utf-8');
}

console.log(next);
