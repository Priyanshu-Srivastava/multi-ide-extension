#!/usr/bin/env node
// Convenience wrapper — pre-fills --ide vscode.
// Usage: node scripts/adapters/vscode/build.js --team <teamId> [--out <dir>] [--skip-compile]
'use strict';
const { execSync } = require('child_process');
const path = require('path');
const args = process.argv.slice(2);
if (!args.includes('--team')) {
  console.error('Error: --team <teamId> is required.\nExample: node scripts/adapters/vscode/build.js --team team-a');
  process.exit(1);
}
execSync(
  `node "${path.join(__dirname, '../../build.js')}" --ide vscode ${args.join(' ')}`,
  { stdio: 'inherit' }
);

step('Building @omni/adapters-vscode...');
run('npx tsc -b', ADAPTER_DIR);

step('Packaging VS Code extension (.vsix)...');
run(`npx @vscode/vsce package --no-dependencies --out "${ARTIFACTS_DIR}"`, ADAPTER_DIR);

// ── Report ────────────────────────────────────────────────────────────────────
const vsixFiles = fs.readdirSync(ARTIFACTS_DIR).filter((f) => f.endsWith('.vsix'));
console.log('\n[vscode] Build complete.');
console.log('[vscode] Artifacts:');
vsixFiles.forEach((f) => console.log(`          ${path.join(ARTIFACTS_DIR, f)}`));
console.log('\n[vscode] To install locally:');
vsixFiles.forEach((f) =>
  console.log(`          code --install-extension "${path.join(ARTIFACTS_DIR, f)}"`)
);
