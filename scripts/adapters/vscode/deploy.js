#!/usr/bin/env node
// Convenience wrapper � pre-fills --ide vscode.
// Usage: VSCE_TOKEN=<token> node scripts/adapters/vscode/deploy.js --team <teamId>
'use strict';
const { execSync } = require('child_process');
const path = require('path');
const args = process.argv.slice(2);
if (!args.includes('--team')) {
  console.error('Error: --team <teamId> is required.\nExample: VSCE_TOKEN=<token> node scripts/adapters/vscode/deploy.js --team team-a');
  process.exit(1);
}
execSync(
  `node "${path.join(__dirname, '../../deploy.js')}" --ide vscode ${args.join(' ')}`,
  { stdio: 'inherit' }
);
