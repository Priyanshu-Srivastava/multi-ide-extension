#!/usr/bin/env node
// Convenience wrapper � pre-fills --ide jetbrains.
// Usage: JETBRAINS_TOKEN=<token> JETBRAINS_PLUGIN_ID=<id> node scripts/adapters/jetbrains/deploy.js --team <teamId>
'use strict';
const { execSync } = require('child_process');
const path = require('path');
const args = process.argv.slice(2);
if (!args.includes('--team')) {
  console.error('Error: --team <teamId> is required.\nExample: JETBRAINS_TOKEN=<token> JETBRAINS_PLUGIN_ID=<id> node scripts/adapters/jetbrains/deploy.js --team team-a');
  process.exit(1);
}
execSync(
  `node "${path.join(__dirname, '../../deploy.js')}" --ide jetbrains ${args.join(' ')}`,
  { stdio: 'inherit' }
);
