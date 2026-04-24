# Build & Deployment Manual

## Overview

Every artifact is **team-specific and IDE-specific**. A single build run produces exactly one artifact for one team on one IDE:

```
omni-vscode-team-a-1.0.0.vsix
omni-cursor-team-b-1.0.0.vsix
omni-jetbrains-team-c-1.0.0.zip
```

The master build script (`scripts/build.js`) handles the full pipeline:  
`inject team config → compile TypeScript → stage files → write manifest → package artifact`

---

## Prerequisites

```bash
# Required globally
node --version   # >= 20
npm --version    # >= 10

# Install all workspace dependencies (run once)
npm install
```

Optional tools (only needed for publishing):
```bash
npm install -g @vscode/vsce   # VS Code Marketplace publishing
npm install -g ovsx           # Open VSX (Cursor) publishing
pip install requests          # JetBrains Marketplace upload (Python 3)
```

---

## Local Build

### Using the master script (all IDEs)

```bash
# Syntax
node scripts/build.js --team <teamId> --ide <vscode|cursor|jetbrains> [--out <dir>] [--skip-compile]

# Examples
node scripts/build.js --team team-a --ide vscode
node scripts/build.js --team team-b --ide cursor  --out dist/my-artifacts
node scripts/build.js --team team-c --ide jetbrains --skip-compile
```

**Flags:**

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--team` | ✅ | — | One of `team-a`, `team-b`, `team-c`, `team-d` |
| `--ide` | ✅ | — | One of `vscode`, `cursor`, `jetbrains` |
| `--out` | ❌ | `artifacts/` | Directory to write the artifact to |
| `--skip-compile` | ❌ | false | Skip TypeScript compilation (reuse existing `dist/`) |

### Using IDE-specific convenience wrappers

The `--ide` flag is pre-filled; only `--team` is required:

```bash
# VS Code
node scripts/adapters/vscode/build.js --team team-a
node scripts/adapters/vscode/build.js --team team-b --out dist/

# Cursor
node scripts/adapters/cursor/build.js --team team-a

# JetBrains
node scripts/adapters/jetbrains/build.js --team team-a
```

### Using npm workspace scripts

```bash
# These expect --team to be appended
npm run build:vscode -- --team team-a
npm run build:cursor -- --team team-b
npm run build:jetbrains -- --team team-c

# Build all IDEs for one team
npm run build:all-adapters   # (add --team manually to each)
```

---

## What the Build Script Does

```
1.  Validate --team and --ide arguments
2.  Create artifacts/ output directory
3.  Resolve team manifest: teams/<team>/manifests/<ide>.json
4.  Write __generated__/team-config.ts with TEAM_ID constant
5.  Compile @omni/core (tsc -b packages/core)
6.  Compile target adapter (tsc -b packages/adapters/<ide>)
7.  Stage node_modules into dist/
8.  Write final extension manifest (package.json for vscode/cursor, plugin.xml for jetbrains)
9.  Package artifact:
      vscode/cursor  → npx @vscode/vsce package → .vsix
      jetbrains      → Compress-Archive / zip → .zip
10. Restore __generated__/team-config.ts to placeholder
11. Print artifact path
```

---

## Local Install (Test Before Publishing)

### VS Code
```bash
# After building
code --install-extension artifacts/omni-vscode-team-a-1.0.0.vsix

# Or use the convenience script
bash scripts/install-vscode.sh team-a
```

### Cursor
```bash
cursor --install-extension artifacts/omni-cursor-team-a-1.0.0.vsix

bash scripts/install-cursor.sh team-a
```

### JetBrains (IntelliJ / WebStorm)
```
Settings → Plugins → ⚙ → Install Plugin from Disk → select the .zip
```

After installing, restart the IDE. The Omni sidecar starts automatically on IDE startup. Verify it's running:
```bash
curl http://127.0.0.1:7654/health
# → {"ok":true,"teamId":"team-a","tools":[...]}
```

---

## Deployment (Publishing)

### Prerequisites — Tokens

| IDE | Env Variable | Where to get it |
|-----|-------------|-----------------|
| VS Code | `VSCE_TOKEN` | [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage) → Personal Access Tokens |
| Cursor | `OVSX_TOKEN` | [open-vsx.org/user-settings/tokens](https://open-vsx.org/user-settings/tokens) |
| JetBrains | `JETBRAINS_TOKEN` | [hub.jetbrains.com](https://hub.jetbrains.com/users/me?tab=authentications) → Permanent Tokens |

**Never commit tokens.** Store them as GitHub repository secrets (see CI/CD section).

### Deploy — VS Code Marketplace

```bash
# Build first
node scripts/build.js --team team-a --ide vscode

# Deploy
VSCE_TOKEN=<your-pat> node scripts/deploy.js --team team-a --ide vscode

# Pre-release channel
VSCE_TOKEN=<your-pat> node scripts/deploy.js --team team-a --ide vscode --pre-release

# Convenience wrapper
VSCE_TOKEN=<your-pat> node scripts/adapters/vscode/deploy.js --team team-a
```

### Deploy — Cursor / Open VSX

```bash
node scripts/build.js --team team-a --ide cursor

OVSX_TOKEN=<your-token> node scripts/deploy.js --team team-a --ide cursor
```

### Deploy — JetBrains Marketplace

```bash
node scripts/build.js --team team-a --ide jetbrains

# Node.js deploy (uses JetBrains REST API)
JETBRAINS_TOKEN=<token> node scripts/deploy.js --team team-a --ide jetbrains

# Optional: specify release channel (default: Stable)
JETBRAINS_TOKEN=<token> node scripts/deploy.js --team team-a --ide jetbrains --channel Beta

# Python alternative
python scripts/deploy-jetbrains.py --artifact artifacts/omni-jetbrains-team-a-1.0.0.zip --token <token>
```

### Deploy with a specific artifact path

```bash
# Override artifact resolution (useful in CI after downloading from GitHub Actions)
VSCE_TOKEN=<token> node scripts/deploy.js --team team-a --ide vscode --artifact /tmp/download/omni-vscode-team-a-1.0.0.vsix
```

---

## CI/CD Workflows

### Workflow overview

| Workflow | Trigger | Matrix | Output |
|----------|---------|--------|--------|
| `build-vscode.yml` | Push to `main`/`develop`, PR, manual dispatch | `[team-a, team-b, team-c, team-d]` | 4 `.vsix` artifacts |
| `build-cursor.yml` | Push to `main`/`develop`, PR, manual dispatch | `[team-a, team-b, team-c, team-d]` | 4 `.vsix` artifacts |
| `build-jetbrains.yml` | Push to `main`/`develop`, PR, manual dispatch | `[team-a, team-b, team-c, team-d]` | 4 `.zip` artifacts |
| `validate-spec.yml` | Changes to `teams/**/specs/**` | — | Spec validation |
| `team-a.yml` … `team-d.yml` | Changes to `teams/team-*/` | — | lint + test + spec |
| `controller.yml` | Changes to `controller/**` | — | Build + validate all specs |

### Manually triggering a build (workflow_dispatch)

1. Go to **GitHub → Actions → Build & Package — VS Code Extension**
2. Click **Run workflow**
3. Select `team` (leave empty for all teams) and `publish` (`true` to also publish)

### GitHub repository secrets required

Add these under **Settings → Secrets and variables → Actions**:

| Secret | Used by |
|--------|---------|
| `VSCE_TOKEN` | `build-vscode.yml` publish step |
| `OVSX_TOKEN` | `build-cursor.yml` publish step |
| `JETBRAINS_TOKEN` | `build-jetbrains.yml` publish step |

### Artifact retention

CI artifacts are uploaded via `actions/upload-artifact` with the naming convention:  
`vscode-team-a`, `cursor-team-b`, `jetbrains-team-c`, etc.

Default retention: **90 days** (configurable in workflow YAML).

---

## Versioning

Version numbers come from each team's manifest file:

```json
// teams/team-a/manifests/vscode.json
{
  "version": "1.0.0"
}
```

To release a new version:
1. Update `version` in `teams/<team>/manifests/<ide>.json`
2. (Optional) Update `packages/adapters/<ide>/package.json` version
3. Commit, merge to `main`
4. Trigger the workflow manually with `publish: true`, or the workflow auto-publishes on `main` push if configured

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `--team is required` error | Pass `--team team-a` to the script |
| `vscode: command not found` in CI | Ensure Node 20 is set up; `vsce` is a devDependency, use `npx @vscode/vsce` |
| JetBrains sidecar not starting | Check `OMNI_SIDECAR_PORT` isn't in use; try `curl 127.0.0.1:7654/health` |
| `VSCE_TOKEN` invalid | PAT must have `Marketplace (Publish)` scope, linked to correct publisher |
| Build fails on `tsc -b packages/core` | Run `npm install` first; ensure Node ≥ 20 |
| `.vsix` too large | Check `__generated__/` is excluded in `.vscodeignore` |
