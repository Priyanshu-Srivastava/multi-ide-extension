#!/usr/bin/env node
// =============================================================================
// scripts/deploy.js — Team-specific, IDE-specific deploy script.
//
// Prerequisites:
//   Run scripts/build.js first to produce the artifact.
//
// Usage:
//   VSCE_TOKEN=<pat>  node scripts/deploy.js --team <teamId> --ide vscode  [--pre-release]
//   OVSX_TOKEN=<pat>  node scripts/deploy.js --team <teamId> --ide cursor
//   node scripts/deploy.js --team <teamId> --ide jetbrains [--channel Stable|Beta|EAP]
//                                                            [--artifact <path>]
//
// The deploy script resolves the artifact from artifacts/ automatically. Pass
// --artifact <path> to override (useful in CI after downloading the artifact).
// =============================================================================
'use strict';

const { execSync } = require('child_process');
const path         = require('path');
const fs           = require('fs');

// ── Helpers ───────────────────────────────────────────────────────────────────
function run(cmd, cwd, env) {
  console.log(`\n  $ ${cmd.replace(/--pat\s+\S+/, '--pat ***').replace(/-p\s+\S{4,}/, '-p ***')}`);
  execSync(cmd, { cwd: cwd || ROOT, stdio: 'inherit', env: Object.assign({}, process.env, env || {}) });
}

function step(msg) {
  console.log(`\n[deploy:${IDE}:${TEAM}] ── ${msg}`);
}

function bail(msg) {
  console.error(`\n[deploy] Error: ${msg}`);
  console.error('Usage: node scripts/deploy.js --team <teamId> --ide <vscode|cursor|jetbrains> [--artifact <path>]\n');
  process.exit(1);
}

// ── Parse CLI args ─────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function getArg(flag) {
  const i = argv.indexOf(flag);
  return i !== -1 ? argv[i + 1] : null;
}

const TEAM        = getArg('--team');
const IDE         = getArg('--ide');
const ARTIFACT    = getArg('--artifact');
const JB_CHANNEL  = getArg('--channel') || 'Stable';
const PRE_RELEASE = argv.includes('--pre-release') ? '--pre-release' : '';

const VALID_TEAMS = ['team-a', 'team-b', 'team-c', 'team-d'];
const VALID_IDES  = ['vscode', 'cursor', 'jetbrains'];

if (!TEAM)                       bail('--team is required');
if (!VALID_TEAMS.includes(TEAM)) bail(`--team must be one of: ${VALID_TEAMS.join(', ')}`);
if (!IDE)                        bail('--ide is required');
if (!VALID_IDES.includes(IDE))   bail(`--ide must be one of: ${VALID_IDES.join(', ')}`);

// ── Paths ─────────────────────────────────────────────────────────────────────
const ROOT          = path.resolve(__dirname, '..');
const ARTIFACTS_DIR = path.join(ROOT, 'artifacts');
const ADAPTER_DIR   = path.join(ROOT, 'packages', 'adapters', IDE);

// Resolve artifact path
function resolveArtifact(ext) {
  if (ARTIFACT) {
    if (!fs.existsSync(ARTIFACT)) bail(`Artifact not found: ${ARTIFACT}`);
    return ARTIFACT;
  }
  // Auto-detect by glob pattern in artifacts/
  const files = fs.existsSync(ARTIFACTS_DIR)
    ? fs.readdirSync(ARTIFACTS_DIR).filter((f) => f.startsWith(`omni-${IDE}-${TEAM}-`) && f.endsWith(ext))
    : [];
  if (files.length === 0) {
    bail(`No artifact found in artifacts/ matching omni-${IDE}-${TEAM}-*${ext}.\n  Run: node scripts/build.js --team ${TEAM} --ide ${IDE}`);
  }
  if (files.length > 1) {
    console.warn(`[deploy] Multiple artifacts found — using latest: ${files[files.length - 1]}`);
  }
  return path.join(ARTIFACTS_DIR, files[files.length - 1]);
}

console.log(`\n${'═'.repeat(72)}`);
console.log(`  Omni Deploy  |  IDE: ${IDE}  |  Team: ${TEAM}`);
console.log(`${'═'.repeat(72)}`);

// ── VS Code Marketplace ───────────────────────────────────────────────────────
if (IDE === 'vscode') {
  const token = process.env.VSCE_TOKEN;
  if (!token) {
    bail(
      'VSCE_TOKEN environment variable is not set.\n' +
      '  Obtain a PAT from: https://marketplace.visualstudio.com/manage\n' +
      '  Usage: VSCE_TOKEN=<token> node scripts/deploy.js --team ' + TEAM + ' --ide vscode'
    );
  }

  const artifact = resolveArtifact('.vsix');
  step(`Publishing ${path.basename(artifact)} to Visual Studio Marketplace...`);
  run(`npx @vscode/vsce publish --no-dependencies --pat "${token}" ${PRE_RELEASE} "${artifact}"`, ADAPTER_DIR);

  step('Published successfully.');
  console.log(`\n  Extension  : omni-vscode-${TEAM}`);
  console.log(`  Marketplace: https://marketplace.visualstudio.com/\n`);
}

// ── Open VSX (Cursor) ─────────────────────────────────────────────────────────
if (IDE === 'cursor') {
  const token = process.env.OVSX_TOKEN;
  if (!token) {
    bail(
      'OVSX_TOKEN environment variable is not set.\n' +
      '  Obtain a token from: https://open-vsx.org/user-settings/tokens\n' +
      '  Usage: OVSX_TOKEN=<token> node scripts/deploy.js --team ' + TEAM + ' --ide cursor'
    );
  }

  const artifact = resolveArtifact('.vsix');
  step(`Publishing ${path.basename(artifact)} to Open VSX Registry...`);
  run(`npx ovsx publish "${artifact}" -p "${token}" ${PRE_RELEASE}`, ROOT);

  step('Published successfully.');
  console.log(`\n  Extension  : omni-cursor-${TEAM}`);
  console.log(`  Registry   : https://open-vsx.org/\n`);
}

// ── JetBrains Plugin Marketplace ─────────────────────────────────────────────
if (IDE === 'jetbrains') {
  const token = process.env.JETBRAINS_TOKEN;
  const pluginId = process.env.JETBRAINS_PLUGIN_ID;

  if (!token) {
    bail(
      'JETBRAINS_TOKEN environment variable is not set.\n' +
      '  Obtain a permanent token from: https://plugins.jetbrains.com/author/me/tokens\n' +
      '  Usage: JETBRAINS_TOKEN=<token> JETBRAINS_PLUGIN_ID=<id> node scripts/deploy.js --team ' + TEAM + ' --ide jetbrains'
    );
  }
  if (!pluginId) {
    bail('JETBRAINS_PLUGIN_ID environment variable is not set (numeric plugin ID from JetBrains Marketplace).');
  }

  const artifact = resolveArtifact('.zip');
  step(`Uploading ${path.basename(artifact)} to JetBrains Plugin Marketplace (channel: ${JB_CHANNEL})...`);

  // JetBrains upload API: https://plugins.jetbrains.com/docs/marketplace/plugin-upload.html
  const uploadCmd = [
    'curl', '--fail', '--silent', '--show-error',
    '-F', `file=@"${artifact}"`,
    '-F', `channel=${JB_CHANNEL}`,
    '-H', `Authorization: Bearer ${token}`,
    `https://plugins.jetbrains.com/plugin/uploadPlugin?pluginId=${pluginId}`,
  ].join(' ');

  run(uploadCmd, ROOT);
  step('Uploaded successfully.');
  console.log(`\n  Plugin: omni-jetbrains-${TEAM}`);
  console.log(`  Marketplace: https://plugins.jetbrains.com/plugin/${pluginId}\n`);
}
