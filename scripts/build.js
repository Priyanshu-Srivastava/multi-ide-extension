#!/usr/bin/env node
// =============================================================================
// scripts/build.js — Team-specific, IDE-specific build script.
//
// Usage:
//   node scripts/build.js --team <teamId> --ide <vscode|cursor|jetbrains>
//                         [--out <dir>] [--skip-compile]
//
// Examples:
//   node scripts/build.js --team team-a --ide vscode
//   node scripts/build.js --team team-b --ide cursor  --out dist/artifacts
//   node scripts/build.js --team team-c --ide jetbrains --skip-compile
//
// Artifacts produced:
//   artifacts/omni-vscode-team-a-1.0.0.vsix
//   artifacts/omni-cursor-team-a-1.0.0.vsix
//   artifacts/omni-jetbrains-team-a-1.0.0.zip
//
// Per-IDE convenience wrappers (pre-fill --ide):
//   node scripts/adapters/vscode/build.js    --team team-a
//   node scripts/adapters/cursor/build.js    --team team-a
//   node scripts/adapters/jetbrains/build.js --team team-a
// =============================================================================
'use strict';

const { execSync } = require('child_process');
const path         = require('path');
const fs           = require('fs');

// ── Constants ─────────────────────────────────────────────────────────────────
const VALID_TEAMS = ['team-a', 'team-b', 'team-c', 'team-d'];
const VALID_IDES  = ['vscode', 'cursor', 'jetbrains'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function run(cmd, cwd) {
  console.log(`\n  $ ${cmd}`);
  execSync(cmd, { cwd: cwd || ROOT, stdio: 'inherit' });
}

function step(msg) {
  console.log(`\n[build:${IDE}:${TEAM}] ── ${msg}`);
}

function bail(msg) {
  console.error(`\n[build] Error: ${msg}`);
  console.error('Usage: node scripts/build.js --team <teamId> --ide <vscode|cursor|jetbrains> [--out <dir>] [--skip-compile]\n');
  process.exit(1);
}

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirSync(s, d);
    else fs.copyFileSync(s, d);
  }
}

function stageOmniPackage(pkgName, pkgDir, stagingNodeModules) {
  const destDir = path.join(stagingNodeModules, ...pkgName.split('/'));
  fs.mkdirSync(destDir, { recursive: true });
  copyDirSync(path.join(pkgDir, 'dist'),       path.join(destDir, 'dist'));
  fs.copyFileSync(path.join(pkgDir, 'package.json'), path.join(destDir, 'package.json'));
}

function zipDirectorySync(srcDir, destFile) {
  if (process.platform === 'win32') {
    run(
      `powershell -NoProfile -Command "Compress-Archive -Path '${srcDir}\\*' -DestinationPath '${destFile}' -Force"`,
      ROOT
    );
  } else {
    run(`zip -r "${destFile}" .`, srcDir);
  }
}

// ── Parse CLI args ─────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function getArg(flag) {
  const i = argv.indexOf(flag);
  return i !== -1 ? argv[i + 1] : null;
}

const TEAM         = getArg('--team');
const IDE          = getArg('--ide');
const OUT_DIR      = getArg('--out');
const SKIP_COMPILE = argv.includes('--skip-compile');

// ── Validate ──────────────────────────────────────────────────────────────────
if (!TEAM)                       bail('--team is required');
if (!VALID_TEAMS.includes(TEAM)) bail(`--team must be one of: ${VALID_TEAMS.join(', ')}`);
if (!IDE)                        bail('--ide is required');
if (!VALID_IDES.includes(IDE))   bail(`--ide must be one of: ${VALID_IDES.join(', ')}`);

// ── Version Validation ────────────────────────────────────────────────────────
try {
  execSync(`node "${path.resolve(__dirname, 'validate-version.js')}" --team ${TEAM} --ide ${IDE}`, { stdio: 'inherit' });
} catch (error) {
  bail('Version validation failed. Aborting build.');
}
const ROOT          = path.resolve(__dirname, '..');
const ARTIFACTS_DIR = path.resolve(ROOT, OUT_DIR || 'artifacts');
const ADAPTER_DIR   = path.join(ROOT, 'packages', 'adapters', IDE);
const TEAM_DIR      = path.join(ROOT, 'teams', TEAM);
const MANIFEST_PATH = path.join(TEAM_DIR, 'manifests', `${IDE}.json`);
const GENERATED_DIR = path.join(ADAPTER_DIR, 'src', '__generated__');
const GENERATED_FILE= path.join(GENERATED_DIR, 'team-config.ts');
const STAGING_DIR   = path.join(ROOT, 'dist', `staging-${IDE}-${TEAM}`);

// For cursor: also update the vscode adapter's generated file (cursor re-exports activate from vscode)
const VSCODE_GENERATED_FILE = IDE === 'cursor'
  ? path.join(ROOT, 'packages', 'adapters', 'vscode', 'src', '__generated__', 'team-config.ts')
  : null;

// ── Load team manifest ────────────────────────────────────────────────────────
if (!fs.existsSync(MANIFEST_PATH)) {
  bail(`Team manifest not found: teams/${TEAM}/manifests/${IDE}.json`);
}
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
const VERSION   = manifest.version || '1.0.0';

console.log(`\n${'═'.repeat(72)}`);
console.log(`  Omni Build  |  IDE: ${IDE}  |  Team: ${TEAM}  |  v${VERSION}`);
console.log(`${'═'.repeat(72)}`);

// ── Step 1: Generate team-config.ts ──────────────────────────────────────────
step('Generating team-config.ts...');
const GENERATED_CONTENT = [
  '// AUTO-GENERATED by scripts/build.js — DO NOT EDIT MANUALLY.',
  `// Run: node scripts/build.js --team ${TEAM} --ide ${IDE}`,
  `export const TEAM_ID = '${TEAM}' as const;`,
  '',
].join('\n');

fs.mkdirSync(GENERATED_DIR, { recursive: true });
fs.writeFileSync(GENERATED_FILE, GENERATED_CONTENT, 'utf-8');

// Cursor re-exports from the vscode adapter, so we also need to inject TEAM_ID there.
if (VSCODE_GENERATED_FILE) {
  fs.writeFileSync(VSCODE_GENERATED_FILE, GENERATED_CONTENT.replace(`--ide ${IDE}`, '--ide vscode (via cursor)'), 'utf-8');
}

// ── Step 2: Compile TypeScript ────────────────────────────────────────────────
if (!SKIP_COMPILE) {
  step('Compiling @omni/core...');
  run('npx tsc -b packages/core/tsconfig.json');

  step('Compiling @omni/mcp...');
  run('npx tsc -b packages/mcp/tsconfig.json');

  step(`Compiling @omni/${TEAM}...`);
  run(`npx tsc -b teams/${TEAM}/tsconfig.json`);

  if (IDE === 'cursor') {
    step('Compiling @omni/adapters-vscode (required by cursor)...');
    run('npx tsc -b packages/adapters/vscode/tsconfig.json');
  }

  step(`Compiling @omni/adapters-${IDE}...`);
  run('npx tsc -b', ADAPTER_DIR);
}

// ── Step 3: Prepare staging directory ────────────────────────────────────────
step('Staging extension files...');
fs.rmSync(STAGING_DIR, { recursive: true, force: true });
fs.mkdirSync(STAGING_DIR, { recursive: true });

const adapterDist = path.join(ADAPTER_DIR, 'dist');
if (!fs.existsSync(adapterDist)) {
  bail(`Adapter dist not found: packages/adapters/${IDE}/dist/\n  Ensure TypeScript has been compiled or remove --skip-compile.`);
}

copyDirSync(adapterDist, path.join(STAGING_DIR, 'dist'));

// Copy mcp.config.json (teams can override later)
const mcpConfigSrc = path.join(ROOT, 'packages', 'mcp', 'mcp.config.json');
if (fs.existsSync(mcpConfigSrc)) {
  fs.copyFileSync(mcpConfigSrc, path.join(STAGING_DIR, 'mcp.config.json'));
}

// Copy LICENSE file (required by vsce)
const licenseSrc = path.join(ROOT, 'LICENSE');
if (fs.existsSync(licenseSrc)) {
  fs.copyFileSync(licenseSrc, path.join(STAGING_DIR, 'LICENSE'));
}

// ── Step 4: Stage @omni packages as node_modules ─────────────────────────────
step('Staging @omni runtime packages into node_modules...');
const stagingModules = path.join(STAGING_DIR, 'node_modules');

stageOmniPackage('@omni/core',  path.join(ROOT, 'packages', 'core'),  stagingModules);
stageOmniPackage('@omni/mcp',   path.join(ROOT, 'packages', 'mcp'),   stagingModules);
stageOmniPackage(`@omni/${TEAM}`, TEAM_DIR,                            stagingModules);

if (IDE === 'cursor') {
  stageOmniPackage('@omni/adapters-vscode', path.join(ROOT, 'packages', 'adapters', 'vscode'), stagingModules);
}

// ── Step 5: Write extension manifest ─────────────────────────────────────────
step('Writing extension package.json...');
let extensionPkg;

if (IDE === 'vscode' || IDE === 'cursor') {
  const BUNDLED_DEPS = ['@omni/core', '@omni/mcp', `@omni/${TEAM}`];
  extensionPkg = {
    name:               manifest.name,
    displayName:        manifest.displayName,
    description:        manifest.description,
    version:            VERSION,
    publisher:          manifest.publisher,
    license:            manifest.license || 'MIT',
    engines:            manifest.engines || { vscode: '^1.80.0' },
    categories:         manifest.categories || ['Other'],
    activationEvents:   manifest.activationEvents || ['onStartupFinished'],
    main:               './dist/activate.js',
    contributes:        manifest.contributes || {},
    keywords:           manifest.keywords || [],
    repository:         manifest.repository || {},
    scripts:            {},
    devDependencies:    {},
    // Declare bundled deps so vsce includes them from staged node_modules
    dependencies:       Object.fromEntries(BUNDLED_DEPS.map(p => [p, '1.0.0'])),
    bundledDependencies: BUNDLED_DEPS,
  };
} else {
  // JetBrains — plain Node.js package descriptor
  extensionPkg = {
    name:        manifest.name,
    version:     VERSION,
    description: manifest.description || '',
    license:     manifest.license || 'MIT',
    main:        './dist/activate.js',
    scripts:     { start: 'node dist/activate.js' },
    omniSidecar: manifest.sidecar || {},
  };
}

fs.writeFileSync(path.join(STAGING_DIR, 'package.json'), JSON.stringify(extensionPkg, null, 2), 'utf-8');

// ── Step 6: .vscodeignore (include node_modules we staged) ───────────────────
if (IDE === 'vscode' || IDE === 'cursor') {
  const vscodeignore = [
    '**/*.ts',
    '!**/*.d.ts',
    '**/*.map',
    '.gitignore',
    '.eslintrc*',
    'tsconfig*',
    '**/__tests__/**',
    '!node_modules/**',   // include manually-staged runtime deps (@omni/core, @omni/mcp, @omni/<team>)
  ].join('\n');
  fs.writeFileSync(path.join(STAGING_DIR, '.vscodeignore'), vscodeignore, 'utf-8');
}

// ── Step 7: Package ───────────────────────────────────────────────────────────
step('Packaging artifact...');
fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

if (IDE === 'vscode' || IDE === 'cursor') {
  const vsixName = `omni-${IDE}-${TEAM}-${VERSION}.vsix`;
  const vsixPath = path.join(ARTIFACTS_DIR, vsixName);
  const vsceCmd  = path.join(ROOT, 'node_modules', '.bin', 'vsce');
  // No --no-dependencies: vsce reads bundledDependencies from package.json
  // and includes the staged node_modules in the VSIX.
  run(`"${vsceCmd}" package --out "${vsixPath}"`, STAGING_DIR);

  const installer = IDE === 'cursor' ? 'cursor' : 'code';
  step('Done!');
  console.log(`\n  Artifact : ${vsixPath}`);
  console.log(`  Install  : ${installer} --install-extension "${vsixPath}"\n`);
} else {
  const zipName = `omni-jetbrains-${TEAM}-${VERSION}.zip`;
  const zipPath = path.join(ARTIFACTS_DIR, zipName);
  zipDirectorySync(STAGING_DIR, zipPath);

  step('Done!');
  console.log(`\n  Artifact : ${zipPath}`);
  console.log(`  Start    : node dist/activate.js  (from the unzipped directory)\n`);
}

// ── Step 8: Cleanup ───────────────────────────────────────────────────────────
step('Cleaning up...');
fs.rmSync(STAGING_DIR, { recursive: true, force: true });

// Restore generated placeholder so git diff stays clean
const PLACEHOLDER = '// AUTO-GENERATED by scripts/build.js — DO NOT EDIT MANUALLY.\nexport const TEAM_ID = \'unknown\' as const;\n';
fs.writeFileSync(GENERATED_FILE, PLACEHOLDER, 'utf-8');
if (VSCODE_GENERATED_FILE) {
  fs.writeFileSync(VSCODE_GENERATED_FILE, PLACEHOLDER, 'utf-8');
}
