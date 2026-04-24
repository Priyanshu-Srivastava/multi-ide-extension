# Omni IDE Universal Extension

A **production-ready, multi-team, multi-IDE extension monorepo** that ships a single unified developer experience across VS Code, Cursor, and JetBrains IDEs — with team-isolated builds, a global MCP tool registry, and a hexagonal architecture enforced by TypeScript project references and ESLint boundary rules.

---

## Quick Links

| Document | Description |
|----------|-------------|
| [Architecture](docs/architecture.md) | Patterns used, component map, design rationale |
| [Folder Structure](docs/folder-structure.md) | Every folder and file explained |
| [Build & Deploy](docs/deployment.md) | Local builds, CI/CD, marketplace publishing |
| [MCP Tools](docs/mcp-tools.md) | Built-in VS Code MCP tools, configuration, adding new tools |
| [Metrics & Telemetry](docs/telemetry.md) | Event schema, governance API, logging |
| [Contributing](docs/contributing.md) | Adding a team, onboarding a new IDE adapter |

---

## At a Glance

```
┌─────────────────────────────────────────────────────────────┐
│                      Omni IDE Monorepo                      │
│                                                             │
│   teams/          ← team feature code (team-a … team-d)    │
│   packages/core   ← shared ports, domain, RPC contracts     │
│   packages/mcp    ← global MCP tool registry + config       │
│   packages/adapters/{vscode,cursor,jetbrains}               │
│                   ← IDE-specific wiring + MCP tool impls    │
│   controller/     ← governance API + dashboard metrics      │
│   scripts/        ← build, deploy, validate-spec            │
└─────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 20 |
| npm | ≥ 10 |
| TypeScript | 5.6+ (installed as devDependency) |

---

## Getting Started

```bash
# 1. Install all workspace dependencies
npm install

# 2. Build every package in dependency order
npm run build

# 3. Validate all team specs
npm run validate:spec

# 4. Build a team-specific IDE artifact (local)
node scripts/build.js --team team-a --ide vscode
node scripts/build.js --team team-b --ide cursor
node scripts/build.js --team team-c --ide jetbrains
```

---

## Teams

| Team | Package | Description |
|------|---------|-------------|
| `team-a` | `@omni/team-a` | Feature set A |
| `team-b` | `@omni/team-b` | Feature set B |
| `team-c` | `@omni/team-c` | Feature set C |
| `team-d` | `@omni/team-d` | Feature set D |

Each team owns its spec (`teams/<team>/specs/openspec.json`), its feature code (`src/features/`), and its per-IDE manifest (`manifests/{vscode,cursor,jetbrains}.json`). Teams **never** import adapter packages directly — only `@omni/core` ports.

---

## Supported IDEs

| IDE | Artifact | Registry |
|-----|----------|----------|
| VS Code | `.vsix` | [Visual Studio Marketplace](https://marketplace.visualstudio.com) |
| Cursor | `.vsix` | [Open VSX Registry](https://open-vsx.org) |
| JetBrains | `.zip` sidecar | [JetBrains Marketplace](https://plugins.jetbrains.com) |
