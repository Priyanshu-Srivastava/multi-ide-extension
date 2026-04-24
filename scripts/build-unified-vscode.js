#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TEAMS_DIR = path.join(ROOT, 'teams');
const VALID_IDES = new Set(['vscode', 'cursor', 'jetbrains']);

function getArg(flag) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(flag);
  return i !== -1 ? argv[i + 1] : null;
}

function fail(message) {
  console.error(`\n[build-unified] Error: ${message}`);
  process.exit(1);
}

function run(cmd, cwd) {
  execSync(cmd, { cwd: cwd || ROOT, stdio: 'inherit' });
}

function zipDirectorySync(srcDir, destFile) {
  if (process.platform === 'win32') {
    run(`powershell -NoProfile -Command "Compress-Archive -Path '${srcDir}\\*' -DestinationPath '${destFile}' -Force"`, ROOT);
  } else {
    run(`zip -r \"${destFile}\" .`, srcDir);
  }
}

const versionOverride = getArg('--version');
const outDir = path.resolve(ROOT, getArg('--out') || 'artifacts');
const ide = getArg('--ide') || 'vscode';

if (!VALID_IDES.has(ide)) {
  fail(`Invalid --ide value "${ide}". Expected vscode|cursor`);
}

const UNIFIED_MANIFEST_PATH = path.join(ROOT, 'manifests', `unified-${ide}.json`);

if (!fs.existsSync(UNIFIED_MANIFEST_PATH)) {
  fail(`Global unified manifest not found: ${UNIFIED_MANIFEST_PATH}`);
}

const unifiedManifest = JSON.parse(fs.readFileSync(UNIFIED_MANIFEST_PATH, 'utf-8'));
const version = versionOverride || unifiedManifest.version;

if (!version) {
  fail('Unified version is missing. Set manifests/unified-vscode.json:version or pass --version <x.y.z>');
}

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  fail(`Invalid version "${version}". Expected semantic version x.y.z`);
}

const configuredTeams = Array.isArray(unifiedManifest.teams) ? unifiedManifest.teams : [];
const teamIds = (configuredTeams.length > 0
  ? configuredTeams
  : fs.readdirSync(TEAMS_DIR).filter((entry) => entry.startsWith('team-'))
).sort();

if (teamIds.length === 0) {
  fail('No team directories found under teams/');
}

const teamExtensions = [];
for (const teamId of teamIds) {
  const manifestPath = path.join(TEAMS_DIR, teamId, 'manifests', `${ide}.json`);
  if (!fs.existsSync(manifestPath)) {
    continue;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  if (!manifest.name || !manifest.publisher) {
    fail(`Missing name/publisher in ${manifestPath}`);
  }

  teamExtensions.push({
    team: teamId,
    id: ide === 'jetbrains' ? manifest.name : `${manifest.publisher}.${manifest.name}`,
    version: manifest.version || '0.0.0',
    displayName: manifest.displayName || manifest.name,
    defaultPort: manifest.sidecar && manifest.sidecar.defaultPort,
  });
}

if (teamExtensions.length === 0) {
  fail(`No team ${ide} manifests found to assemble extension pack`);
}

const publisher = ide === 'jetbrains'
  ? (unifiedManifest.publisher || 'omni')
  : (unifiedManifest.publisher || teamExtensions[0].id.split('.')[0]);
const stagingDir = path.join(ROOT, 'dist', `staging-${ide}-unified`);
const readmePath = path.join(stagingDir, 'README.md');

fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(stagingDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

let pkg;
if (ide === 'jetbrains') {
  pkg = {
    name: unifiedManifest.name || 'omni-jetbrains-unified',
    displayName: unifiedManifest.displayName || 'Omni IDE - Unified (JetBrains)',
    description: unifiedManifest.description || 'Unified Omni JetBrains sidecar bundle with team features grouped by team.',
    version,
    publisher,
    license: unifiedManifest.license || 'MIT',
    keywords: unifiedManifest.keywords || ['omni', 'unified', 'jetbrains', 'team-a', 'team-b', 'team-c', 'team-d'],
    repository: unifiedManifest.repository || { type: 'git', url: 'https://github.com/your-org/multi-ide-extension' },
    omniUnified: {
      ide,
      teams: teamExtensions.map((t) => ({ team: t.team, package: t.id, version: t.version, defaultPort: t.defaultPort || null })),
    },
  };
} else {
  pkg = {
    name: unifiedManifest.name || `omni-${ide}-unified`,
    displayName: unifiedManifest.displayName || 'Omni IDE - Unified',
    description: unifiedManifest.description || 'Unified Omni VS Code extension pack that installs all team extensions at their latest published versions.',
    version,
    publisher,
    license: unifiedManifest.license || 'MIT',
    engines: unifiedManifest.engines || { vscode: '^1.80.0' },
    categories: unifiedManifest.categories || ['Other', 'AI'],
    extensionPack: teamExtensions.map((t) => t.id),
    keywords: unifiedManifest.keywords || ['omni', 'unified', 'extension-pack', 'team-a', 'team-b', 'team-c', 'team-d'],
    repository: unifiedManifest.repository || { type: 'git', url: 'https://github.com/your-org/multi-ide-extension' },
  };
}

const metadata = {
  ide,
  globalManifest: `manifests/unified-${ide}.json`,
  unifiedVersion: version,
  builtAt: new Date().toISOString(),
  teamsGroupedByName: teamExtensions.map((t) => t.team),
  teams: teamExtensions,
};

const readme = [
  `# ${pkg.displayName}`,
  '',
  pkg.description,
  '',
  `IDE: ${ide}`,
  '',
  '## Team Feature Groups',
  '',
  ...teamExtensions.map((t) => `- ${t.team}: ${t.id} (manifest version ${t.version})`),
  '',
  'This is a single global extension pack; team versions are managed in each team manifest.',
  `The ${ide} marketplace installs the latest published versions for the listed team extensions.`,
  '',
].join('\n');

fs.writeFileSync(path.join(stagingDir, 'package.json'), JSON.stringify(pkg, null, 2), 'utf-8');
fs.writeFileSync(readmePath, readme, 'utf-8');

const licensePath = path.join(ROOT, 'LICENSE');
if (fs.existsSync(licensePath)) {
  fs.copyFileSync(licensePath, path.join(stagingDir, 'LICENSE'));
}

const artifactExt = ide === 'jetbrains' ? 'zip' : 'vsix';
const artifactName = `omni-${ide}-unified-${version}.${artifactExt}`;
const artifactPath = path.join(outDir, artifactName);
const metaPath = path.join(outDir, `omni-${ide}-unified-${version}.meta.json`);
if (ide === 'jetbrains') {
  zipDirectorySync(stagingDir, artifactPath);
} else {
  const vsce = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'vsce.cmd' : 'vsce');
  execSync(`"${vsce}" package --out "${artifactPath}"`, { cwd: stagingDir, stdio: 'inherit' });
}
fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');

console.log('\n[build-unified] Unified extension packaged successfully');
console.log(`[build-unified] Artifact: ${artifactPath}`);
console.log(`[build-unified] Metadata: ${metaPath}`);
