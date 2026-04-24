# Folder Structure

## Why a Monorepo?

This project uses an **npm Workspaces + Turborepo monorepo** for the following reasons:

| Reason | Detail |
|--------|--------|
| **Atomic changes** | A single PR can update a port contract and all adapters that implement it |
| **Shared TypeScript config** | One `tsconfig.base.json` propagates strict settings everywhere |
| **Dependency graph caching** | Turborepo caches build outputs; unchanged packages are never rebuilt |
| **Team isolation** | Each team is its own workspace package with its own `package.json` and lint boundary |
| **Single `npm install`** | All 12+ workspace packages share a single `node_modules` lockfile |
| **Independent versioning** | Each package has its own `version`; Changesets can manage releases independently |

---

## Top-Level Layout

```
multi-ide-extension/
│
├── packages/               # Shared infrastructure packages
│   ├── core/               # @omni/core — port interfaces, domain, RPC, types
│   ├── mcp/                # @omni/mcp  — MCP registry, config, built-in tools
│   ├── telemetry/          # @omni/telemetry — TelemetryService implementation
│   ├── ui-shell/           # @omni/ui-shell — shared UI primitives
│   └── adapters/           # @omni/adapters — root re-export package
│       ├── vscode/         # @omni/adapters-vscode
│       ├── cursor/         # @omni/adapters-cursor
│       └── jetbrains/      # @omni/adapters-jetbrains
│
├── teams/                  # Feature teams — isolated workspaces
│   ├── team-a/             # @omni/team-a
│   ├── team-b/             # @omni/team-b
│   ├── team-c/             # @omni/team-c
│   └── team-d/             # @omni/team-d
│
├── controller/             # Governance, metrics, dashboard (not shipped)
│   ├── governance-api/     # MetricsEvent ingestion
│   ├── dashboard/          # DashboardData aggregation
│   └── schemas/            # JSON Schema for event validation
│
├── scripts/                # Build, deploy, validation utilities
│   ├── build.js            # Master team+IDE build script
│   ├── deploy.js           # Master team+IDE deploy script
│   ├── validate-spec.js    # Spec file validator (CI gate)
│   └── adapters/
│       ├── vscode/         # build.js + deploy.js (pre-fill --ide vscode)
│       ├── cursor/         # build.js + deploy.js (pre-fill --ide cursor)
│       └── jetbrains/      # build.js + deploy.js (pre-fill --ide jetbrains)
│
├── .github/
│   └── workflows/
│       ├── build-vscode.yml     # Matrix build for all 4 teams × vscode
│       ├── build-cursor.yml     # Matrix build for all 4 teams × cursor
│       ├── build-jetbrains.yml  # Matrix build for all 4 teams × jetbrains
│       ├── validate-spec.yml    # Spec validation on PR
│       ├── team-a.yml           # Team A full pipeline (lint+test+spec)
│       ├── team-b.yml
│       ├── team-c.yml
│       ├── team-d.yml
│       └── controller.yml       # Controller governance pipeline
│
├── tsconfig.base.json      # Shared TS compiler options (Node16, strict)
├── tsconfig.json           # Solution file — lists all project references
├── turbo.json              # Turborepo pipeline definition
├── .eslintrc.json          # Boundary enforcement rules
├── .gitignore
└── package.json            # Root — workspaces definition + convenience scripts
```

---

## Package Deep-Dives

### `packages/core/`

```
packages/core/
└── src/
    ├── ports/
    │   ├── ide-port.ts         IDEActionPort, TelemetryPort interfaces
    │   ├── mcp-port.ts         MCPToolPort, MCPToolInput, MCPToolResult
    │   └── index.ts            barrel
    ├── domain/
    │   └── index.ts            FeatureContext, executeFeatureAction()
    ├── rpc/
    │   └── index.ts            SidecarRequest, SidecarResponse, SidecarTransport
    ├── errors/
    │   └── index.ts            OmniError, PortNotImplementedError, SidecarConnectionError
    ├── types/
    │   └── index.ts            EnvironmentId, TeamId, OmniResult<T>, ToolManifest
    └── utils/
        └── index.ts            assertNonNullable, isRecord, deepMerge
```

**Rule:** Zero imports from adapter packages, `vscode`, or any external SDK.

---

### `packages/mcp/`

```
packages/mcp/
├── mcp.config.json             Default tool config (checked into source)
└── src/
    ├── config/
    │   └── index.ts            MCPConfig, MCPToolConfig, isToolEnabled()
    ├── registry/
    │   ├── registry.ts         MCPRegistry class
    │   ├── external-adapter.ts ExternalMCPToolAdapter
    │   └── index.ts            barrel
    ├── tools/
    │   ├── example-tool.ts     ExampleTool (project-wide built-in)
    │   └── index.ts            barrel
    └── index.ts                top-level barrel + JSDoc usage guide
```

All tools in `tools/` are **global** — available to every team and adapter. Add new project-wide tools here, not inside `teams/`.

---

### `packages/adapters/vscode/`

```
packages/adapters/vscode/
└── src/
    ├── index.ts                VSCodeAdapter (implements IDEActionPort) + re-exports
    ├── activate.ts             VS Code activate() / deactivate() entry point
    ├── __generated__/
    │   └── team-config.ts      TEAM_ID constant — overwritten by scripts/build.js
    └── mcp-tools/
        └── vscode/             8 built-in VS Code MCP tool implementations
            ├── workspace-read-file.ts
            ├── workspace-find-files.ts
            ├── workspace-write-file.ts
            ├── workspace-list-directory.ts
            ├── get-diagnostics.ts
            ├── execute-command.ts
            ├── get-active-editor.ts
            ├── git-status.ts
            └── index.ts
```

---

### `packages/adapters/jetbrains/`

```
packages/adapters/jetbrains/
└── src/
    ├── index.ts                JetBrainsSidecarBridge (implements IDEActionPort)
    ├── activate.ts             Standalone HTTP/JSON-RPC server (main of the .zip)
    └── __generated__/
        └── team-config.ts      TEAM_ID constant
```

The JetBrains artifact is a `.zip` containing a compiled Node.js process. The JetBrains plugin side-loads it and communicates via `http://127.0.0.1:7654`.

---

### `teams/<team>/`

```
teams/team-a/
├── src/
│   ├── features/
│   │   └── index.ts            Feature implementations (use IDEActionPort only)
│   └── index.ts                Public API barrel
├── manifests/
│   ├── vscode.json             VS Code extension manifest (package.json shape)
│   ├── cursor.json             Cursor extension manifest
│   └── jetbrains.json          JetBrains plugin descriptor
├── specs/
│   └── <feature-slug>/
│       ├── openspec.json       OpenSpec contract for the feature
│       ├── spec.md             Feature specification
│       ├── plan.md             Implementation plan
│       ├── tasks.md            Execution task breakdown
│       └── research.md         Technical decisions and findings
├── package.json                @omni/team-a workspace
└── tsconfig.json               project reference → ../../packages/core
```

Central policy file:

```
specs/
└── constitution.md             SpecKit constitution for all teams
```

---

### `controller/`

```
controller/
├── governance-api/
│   └── src/
│       └── index.ts            MetricsEvent type + createGovernanceApi()
├── dashboard/
│   └── src/
│       └── index.ts            DashboardData type + buildDashboardData()
├── schemas/
│   └── metrics.json            JSON Schema for MetricsEvent validation
├── src/
│   └── index.ts                Re-exports both sub-packages
├── package.json
└── tsconfig.json
```

---

### `scripts/`

```
scripts/
├── build.js           Master build: --team + --ide → compiles TS, stages files, packages artifact
├── deploy.js          Master deploy: reads artifact from artifacts/ → publishes to marketplace
├── validate-spec.js   Walks teams/*/specs/, parses JSON, exits 1 on invalid
├── install-vscode.sh  Quick local install of built .vsix into VS Code
├── install-cursor.sh  Quick local install of built .vsix into Cursor
├── deploy-jetbrains.py Python helper for JetBrains Marketplace API upload
└── adapters/
    ├── vscode/
    │   ├── build.js   → delegates to scripts/build.js --ide vscode
    │   └── deploy.js  → delegates to scripts/deploy.js --ide vscode
    ├── cursor/
    │   ├── build.js   → delegates to scripts/build.js --ide cursor
    │   └── deploy.js  → delegates to scripts/deploy.js --ide cursor
    └── jetbrains/
        ├── build.js   → delegates to scripts/build.js --ide jetbrains
        └── deploy.js  → delegates to scripts/deploy.js --ide jetbrains
```

---

### `.github/workflows/`

```
.github/workflows/
├── build-vscode.yml      Triggers on vscode adapter changes; matrix: [team-a..team-d]
├── build-cursor.yml      Triggers on cursor adapter changes; matrix: [team-a..team-d]
├── build-jetbrains.yml   Triggers on jetbrains adapter changes; matrix: [team-a..team-d]
├── validate-spec.yml     Triggers on teams/**/specs/** changes; runs validate-spec.js
├── team-a.yml            Full team-a pipeline (build→lint→test→spec:validate)
├── team-b.yml
├── team-c.yml
├── team-d.yml
└── controller.yml        Controller governance pipeline; validates all team specs
```
