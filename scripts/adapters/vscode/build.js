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
