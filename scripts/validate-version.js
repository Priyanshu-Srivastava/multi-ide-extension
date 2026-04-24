#!/usr/bin/env node
// =============================================================================
// scripts/validate-version.js — Version validation & duplicate prevention.
//
// Checks:
//   1. Version is not already released in releases/ directory
//   2. All team manifests have consistent versions
//   3. Versions follow semantic versioning (major.minor.patch)
//
// Usage:
//   node scripts/validate-version.js --team <teamId> --ide <vscode|cursor|jetbrains>
//   node scripts/validate-version.js --check-all        (validate all teams)
// =============================================================================
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RELEASES_DIR = path.join(ROOT, 'releases');
const TEAMS_DIR = path.join(ROOT, 'teams');

// ── Helper functions ──────────────────────────────────────────────────────────
function fail(message) {
  console.error(`\n❌ Version validation failed: ${message}`);
  process.exit(1);
}

function warn(message) {
  console.warn(`\n⚠️  Warning: ${message}`);
}

function success(message) {
  console.log(`\n✅ ${message}`);
}

function isValidSemver(version) {
  const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?$/;
  return semverRegex.test(version);
}

function getReleasedVersions() {
  if (!fs.existsSync(RELEASES_DIR)) {
    return [];
  }
  return fs.readdirSync(RELEASES_DIR)
    .filter(entry => fs.statSync(path.join(RELEASES_DIR, entry)).isDirectory())
    .map(dir => dir.replace(/^v/, ''));
}

// ── Parse CLI args ────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function getArg(flag) {
  const i = argv.indexOf(flag);
  return i !== -1 ? argv[i + 1] : null;
}

const TEAM = getArg('--team');
const IDE = getArg('--ide');
const CHECK_ALL = argv.includes('--check-all');

// ── Validation ────────────────────────────────────────────────────────────────
if (!CHECK_ALL && (!TEAM || !IDE)) {
  fail('--team and --ide are required, or use --check-all to validate all teams');
}

const releasedVersions = getReleasedVersions();

if (CHECK_ALL) {
  // Validate all teams
  console.log('\n🔍 Checking all team versions...');
  
  const teams = fs.readdirSync(TEAMS_DIR).filter(entry => {
    return entry.startsWith('team-') && fs.statSync(path.join(TEAMS_DIR, entry)).isDirectory();
  });

  let hasErrors = false;
  const versions = {};

  for (const team of teams) {
    const ides = ['vscode', 'cursor', 'jetbrains'];
    
    for (const ide of ides) {
      const manifestPath = path.join(TEAMS_DIR, team, 'manifests', `${ide}.json`);
      
      if (!fs.existsSync(manifestPath)) {
        continue;
      }

      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        const version = manifest.version || '1.0.0';

        if (!isValidSemver(version)) {
          console.error(`  ❌ ${team}/${ide}: Invalid semver "${version}"`);
          hasErrors = true;
          continue;
        }

        // Track versions by team
        if (!versions[team]) {
          versions[team] = version;
        } else if (versions[team] !== version) {
          console.error(`  ❌ ${team}: Version mismatch (${versions[team]} vs ${version} in ${ide})`);
          hasErrors = true;
        }

        // Check if released
        if (releasedVersions.includes(version)) {
          console.error(`  ❌ ${team}/${ide}: Version v${version} already released!`);
          hasErrors = true;
        } else {
          console.log(`  ✓ ${team}/${ide}: v${version} (not yet released)`);
        }
      } catch (error) {
        console.error(`  ❌ ${team}/${ide}: Failed to parse manifest: ${error.message}`);
        hasErrors = true;
      }
    }
  }

  if (hasErrors) {
    fail('Some versions have issues. Fix them before building.');
  }

  success('All team versions are valid and ready for release');
  process.exit(0);
}

// ── Single team validation ────────────────────────────────────────────────────
const manifestPath = path.join(TEAMS_DIR, TEAM, 'manifests', `${IDE}.json`);

if (!fs.existsSync(manifestPath)) {
  fail(`Manifest not found: teams/${TEAM}/manifests/${IDE}.json`);
}

console.log(`\n🔍 Validating version for ${TEAM}/${IDE}...`);

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
} catch (error) {
  fail(`Failed to parse manifest: ${error.message}`);
}

const version = manifest.version || '1.0.0';

console.log(`   Version: v${version}`);

// Check semver format
if (!isValidSemver(version)) {
  fail(`Version "${version}" is not valid semantic versioning (must be X.Y.Z)`);
}

// Check all team IDEs have same version
const otherIdes = ['vscode', 'cursor', 'jetbrains'].filter(i => i !== IDE);
for (const otherIde of otherIdes) {
  const otherPath = path.join(TEAMS_DIR, TEAM, 'manifests', `${otherIde}.json`);
  if (fs.existsSync(otherPath)) {
    try {
      const otherManifest = JSON.parse(fs.readFileSync(otherPath, 'utf-8'));
      const otherVersion = otherManifest.version || '1.0.0';
      
      if (otherVersion !== version) {
        warn(`${TEAM}/${otherIde} has different version: v${otherVersion}`);
      }
    } catch (e) {
      // Skip if invalid
    }
  }
}

// Check if already released
if (releasedVersions.includes(version)) {
  console.error(`\n📦 Released versions: ${releasedVersions.map(v => `v${v}`).join(', ')}`);
  fail(`Version v${version} has already been released. Please bump the version in teams/${TEAM}/manifests/*.json`);
}

console.log(`   Released versions: ${releasedVersions.length > 0 ? releasedVersions.map(v => `v${v}`).join(', ') : 'none'}`);
success(`Version v${version} is ready for release (${TEAM}/${IDE})`);
