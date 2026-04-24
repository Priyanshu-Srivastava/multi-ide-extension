#!/usr/bin/env node
// Convenience wrapper — pre-fills --ide cursor.
// Usage: OVSX_TOKEN=<token> node scripts/adapters/cursor/deploy.js --team <teamId>
'use strict';
const { execSync } = require('child_process');
const path = require('path');
const args = process.argv.slice(2);
if (!args.includes('--team')) {
  console.error('Error: --team <teamId> is required.\nExample: OVSX_TOKEN=<token> node scripts/adapters/cursor/deploy.js --team team-a');
  process.exit(1);
}
execSync(
  `node "${path.join(__dirname, '../../deploy.js')}" --ide cursor ${args.join(' ')}`,
  { stdio: 'inherit' }
);
