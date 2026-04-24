#!/usr/bin/env node
// Convenience wrapper — pre-fills --ide cursor.
// Usage: node scripts/adapters/cursor/build.js --team <teamId> [--out <dir>] [--skip-compile]
'use strict';
const { execSync } = require('child_process');
const path = require('path');
const args = process.argv.slice(2);
if (!args.includes('--team')) {
  console.error('Error: --team <teamId> is required.\nExample: node scripts/adapters/cursor/build.js --team team-a');
  process.exit(1);
}
execSync(
  `node "${path.join(__dirname, '../../build.js')}" --ide cursor ${args.join(' ')}`,
  { stdio: 'inherit' }
);

step('Building @omni/adapters-cursor...');
run('npx tsc -b', ADAPTER_DIR);

step('Packaging Cursor extension (.vsix)...');
// @vscode/vsce produces standard .vsix which Cursor can install
run(`npx @vscode/vsce package --no-dependencies --out "${ARTIFACTS_DIR}"`, ADAPTER_DIR);

// ── Report ────────────────────────────────────────────────────────────────────
const vsixFiles = fs.readdirSync(ARTIFACTS_DIR).filter((f) => f.endsWith('.vsix'));
console.log('\n[cursor] Build complete.');
console.log('[cursor] Artifacts:');
vsixFiles.forEach((f) => console.log(`          ${path.join(ARTIFACTS_DIR, f)}`));
console.log('\n[cursor] To install locally:');
vsixFiles.forEach((f) =>
  console.log(`          cursor --install-extension "${path.join(ARTIFACTS_DIR, f)}"`)
);
