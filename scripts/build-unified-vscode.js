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

function hasBuildOutput(pkgDir) {
  return fs.existsSync(path.join(pkgDir, 'dist'));
}

function ensureRequiredBuildOutputs(teamIds) {
  const required = [
    { name: '@omni/core', dir: path.join(ROOT, 'packages', 'core') },
    ...teamIds.map((teamId) => ({ name: `@omni/${teamId}`, dir: path.join(ROOT, 'teams', teamId) })),
  ];

  const missing = required.filter((entry) => !hasBuildOutput(entry.dir));
  if (missing.length === 0) {
    return;
  }

  console.log(`\n[build-unified] Missing dist output for: ${missing.map((entry) => entry.name).join(', ')}`);
  console.log('[build-unified] Running workspace build (npm run build) to generate required outputs...');
  run('npm run build', ROOT);

  const stillMissing = required.filter((entry) => !hasBuildOutput(entry.dir));
  if (stillMissing.length > 0) {
    fail(`Missing build output after workspace build for: ${stillMissing.map((entry) => entry.name).join(', ')}`);
  }
}

function toTeamTitle(teamId) {
  return String(teamId)
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function mergeUnifiedContributes(unifiedManifest, teamContributes) {
  const containerId = unifiedManifest.sidebarContainerId || 'omni-explorer';

  let container = null;
  const views = [];
  const seenViewIds = new Set();
  const commands = [];
  const seenCommands = new Set();

  for (const entry of teamContributes) {
    const contributes = entry.contributes || {};

    const activitybar = contributes.viewsContainers && contributes.viewsContainers.activitybar;
    if (!container && Array.isArray(activitybar) && activitybar.length > 0) {
      container = activitybar.find((item) => item && item.id === containerId) || activitybar[0];
    }

    const viewGroups = contributes.views && typeof contributes.views === 'object' ? contributes.views : {};
    let teamViews = [];
    for (const maybeViews of Object.values(viewGroups)) {
      if (Array.isArray(maybeViews)) {
        teamViews = teamViews.concat(maybeViews);
      }
    }

    if (teamViews.length === 0) {
      teamViews = [{ id: `omni-features-${entry.team}`, name: toTeamTitle(entry.team), type: 'tree' }];
    }

    for (const view of teamViews) {
      if (!view || !view.id || seenViewIds.has(view.id)) {
        continue;
      }
      seenViewIds.add(view.id);
      views.push(view);
    }

    const manifestCommands = Array.isArray(contributes.commands) ? contributes.commands : [];
    for (const cmd of manifestCommands) {
      if (!cmd || !cmd.command || seenCommands.has(cmd.command)) {
        continue;
      }
      seenCommands.add(cmd.command);
      commands.push(cmd);
    }
  }

  const fallbackContainer = {
    id: containerId,
    title: 'Omni IDE',
    icon: '$(extensions)',
  };

  return {
    viewsContainers: {
      activitybar: [container || fallbackContainer],
    },
    views: {
      [containerId]: views,
    },
    commands,
  };
}

function zipDirectorySync(srcDir, destFile) {
  if (process.platform === 'win32') {
    run(`powershell -NoProfile -Command "Compress-Archive -Path '${srcDir}\\*' -DestinationPath '${destFile}' -Force"`, ROOT);
  } else {
    run(`zip -r \"${destFile}\" .`, srcDir);
  }
}

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) {
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcEntry = path.join(src, entry.name);
    const destEntry = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcEntry, destEntry);
    } else {
      fs.copyFileSync(srcEntry, destEntry);
    }
  }
}

function stageOmniPackage(pkgName, pkgDir, stagingNodeModules) {
  const distDir = path.join(pkgDir, 'dist');
  const packageJsonPath = path.join(pkgDir, 'package.json');
  if (!fs.existsSync(distDir) || !fs.existsSync(packageJsonPath)) {
    fail(`Missing build output for ${pkgName}. Run workspace build first so dist/ exists.`);
  }

  const destDir = path.join(stagingNodeModules, ...pkgName.split('/'));
  fs.mkdirSync(destDir, { recursive: true });
  copyDirSync(distDir, path.join(destDir, 'dist'));
  fs.copyFileSync(packageJsonPath, path.join(destDir, 'package.json'));
}

function buildUnifiedRuntimeMain(teamRuntime) {
  return [
    "const vscode = require('vscode');",
    '',
    `const TEAM_RUNTIME = ${JSON.stringify(teamRuntime, null, 2)};`,
    "const TEAM_FEATURES = [{ id: 'openMath', label: 'Math Panel', hasUI: true }];",
    '',
    'function toTeamTitle(teamId) {',
    "  return String(teamId).replace(/-/g, ' ').replace(/\\b\\w/g, (ch) => ch.toUpperCase());",
    '}',
    '',
    'class FeaturesViewProvider {',
    '  constructor(teamId) {',
    '    this.teamId = teamId;',
    '  }',
    '',
    '  getTreeItem(element) {',
    "    if (element.kind === 'header') {",
    '      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Expanded);',
    "      item.iconPath = new vscode.ThemeIcon('organization');",
    "      item.contextValue = 'teamHeader';",
    '      return item;',
    '    }',
    '',
    '    const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);',
    "    item.iconPath = new vscode.ThemeIcon(element.hasUI ? 'layout-panel' : 'run');",
    "    item.contextValue = 'feature';",
    '    if (element.hasUI) {',
    '      item.tooltip = `Open ${element.label}`;',
    '      item.command = {',
    '        command: `omni.${this.teamId}.feature.${element.featureId}`,',
    '        title: `Open ${element.label}`',
    '      };',
    '    }',
    '    return item;',
    '  }',
    '',
    '  getChildren(element) {',
    '    if (!element) {',
    "      return [{ kind: 'header', label: toTeamTitle(this.teamId) }];",
    '    }',
    "    if (element.kind === 'header') {",
    "      return TEAM_FEATURES.map((feature) => ({ kind: 'feature', label: feature.label, featureId: feature.id, hasUI: feature.hasUI }));",
    '    }',
    '    return [];',
    '  }',
    '}',
    '',
    'function registerTeamCommands(context, teamId) {',
    '  let teamFeatures;',
    '  try {',
    '    teamFeatures = require(`@omni/${teamId}`);',
    '  } catch (error) {',
    '    vscode.window.showErrorMessage(`Omni Unified: failed to load @omni/${teamId}. Rebuild and reinstall the unified VSIX.`);',
    '    return [];',
    '  }',
    '',
    '  return [',
    '    vscode.commands.registerCommand(`omni.${teamId}.showInfo`, () => {',
    '      vscode.window.showInformationMessage(`Omni IDE - ${teamId}`);',
    '    }),',
    '    vscode.commands.registerCommand(`omni.${teamId}.feature.openMath`, () => {',
    '      if (typeof teamFeatures.openMathPanel !== "function") {',
    '        vscode.window.showErrorMessage(`Omni Unified: openMathPanel is not exported by @omni/${teamId}.`);',
    '        return;',
    '      }',
    '      teamFeatures.openMathPanel(context, teamId);',
    '    })',
    '  ];',
    '}',
    '',
    'function activate(context) {',
    '  const disposables = [];',
    '  for (const team of TEAM_RUNTIME) {',
    '    disposables.push(vscode.window.registerTreeDataProvider(team.viewId, new FeaturesViewProvider(team.teamId)));',
    '    disposables.push(...registerTeamCommands(context, team.teamId));',
    '  }',
    '  context.subscriptions.push(...disposables);',
    '}',
    '',
    'function deactivate() {}',
    '',
    'exports.activate = activate;',
    'exports.deactivate = deactivate;',
    '',
  ].join('\n');
}

const versionOverride = getArg('--version');
const outDir = path.resolve(ROOT, getArg('--out') || 'artifacts');
const ide = getArg('--ide') || 'vscode';

if (!VALID_IDES.has(ide)) {
  fail(`Invalid --ide value "${ide}". Expected vscode|cursor|jetbrains`);
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
const teamContributes = [];
const teamRuntime = [];
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

  teamContributes.push({
    team: teamId,
    contributes: manifest.contributes || {},
  });

  const manifestViews = manifest.contributes && manifest.contributes.views && typeof manifest.contributes.views === 'object'
    ? manifest.contributes.views
    : {};
  let viewId = null;
  for (const maybeViews of Object.values(manifestViews)) {
    if (Array.isArray(maybeViews)) {
      const teamView = maybeViews.find((view) => view && view.id);
      if (teamView && teamView.id) {
        viewId = teamView.id;
        break;
      }
    }
  }

  teamRuntime.push({
    teamId,
    viewId: viewId || `omni-features-${teamId}`,
  });
}

if (teamExtensions.length === 0) {
  fail(`No team ${ide} manifests found to assemble extension pack`);
}

if (ide !== 'jetbrains') {
  ensureRequiredBuildOutputs(teamIds);
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
  const unifiedContributes = mergeUnifiedContributes(unifiedManifest, teamContributes);
  const bundledDeps = ['@omni/core', ...teamIds.map((teamId) => `@omni/${teamId}`)];
  pkg = {
    name: unifiedManifest.name || `omni-${ide}-unified`,
    displayName: unifiedManifest.displayName || 'Omni IDE - Unified',
    description: unifiedManifest.description || 'Unified Omni VS Code extension pack that installs all team extensions at their latest published versions.',
    version,
    publisher,
    license: unifiedManifest.license || 'MIT',
    engines: unifiedManifest.engines || { vscode: '^1.80.0' },
    categories: unifiedManifest.categories || ['Other', 'AI'],
    main: './main.js',
    activationEvents: ['onStartupFinished'],
    contributes: unifiedContributes,
    extensionPack: teamExtensions.map((t) => t.id),
    keywords: unifiedManifest.keywords || ['omni', 'unified', 'extension-pack', 'team-a', 'team-b', 'team-c', 'team-d'],
    repository: unifiedManifest.repository || { type: 'git', url: 'https://github.com/your-org/multi-ide-extension' },
    dependencies: Object.fromEntries(bundledDeps.map((pkgName) => [pkgName, '1.0.0'])),
    bundledDependencies: bundledDeps,
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
if (ide !== 'jetbrains') {
  const stagingModules = path.join(stagingDir, 'node_modules');
  stageOmniPackage('@omni/core', path.join(ROOT, 'packages', 'core'), stagingModules);
  for (const teamId of teamIds) {
    stageOmniPackage(`@omni/${teamId}`, path.join(ROOT, 'teams', teamId), stagingModules);
  }

  fs.writeFileSync(
    path.join(stagingDir, 'main.js'),
    buildUnifiedRuntimeMain(teamRuntime),
    'utf-8',
  );

  fs.writeFileSync(
    path.join(stagingDir, '.vscodeignore'),
    [
      '**/*.ts',
      '!**/*.d.ts',
      '**/*.map',
      '.gitignore',
      '.eslintrc*',
      'tsconfig*',
      '**/__tests__/**',
      '!node_modules/**',
    ].join('\n'),
    'utf-8',
  );
}
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
