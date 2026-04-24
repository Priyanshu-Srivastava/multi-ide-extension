# Architecture

## Pattern: Hexagonal Architecture (Ports & Adapters)

Omni uses **Hexagonal Architecture** (also called Ports & Adapters or Clean Architecture). The core rule is:

> **Domain code never depends on IDE SDKs. IDE SDKs never leak into domain code.**

All dependencies point **inward** — toward `@omni/core`. The outer layers (adapters, teams) depend on the inner layer. The inner layer knows nothing about VS Code, JetBrains, or any external SDK.

### Why Hexagonal?

| Concern | Benefit |
|---------|---------|
| **Testability** | Domain and team logic can be unit-tested with mock ports — no IDE installed |
| **IDE portability** | Swap the VS Code adapter for a JetBrains sidecar without touching team code |
| **Boundary enforcement** | ESLint import rules prevent teams from importing adapters directly |
| **Replaceability** | Any adapter can be replaced or mocked without rewriting business logic |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Extension Host / Runtime                          │
│                                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                   │
│  │   VS Code    │   │    Cursor    │   │  JetBrains   │                   │
│  │   Adapter    │   │   Adapter    │   │  Sidecar     │                   │
│  │ (packages/   │   │ (packages/   │   │ (packages/   │                   │
│  │ adapters/    │   │ adapters/    │   │ adapters/    │                   │
│  │ vscode)      │   │ cursor)      │   │ jetbrains)   │                   │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘                   │
│         │                  │                  │                             │
│         └──────────────────┴──────────────────┘                             │
│                            │ implements                                      │
│                  ┌─────────▼──────────┐                                     │
│                  │   @omni/core        │  ← Ports, Domain, RPC, Types       │
│                  │   (Port Interfaces) │                                     │
│                  └─────────┬──────────┘                                     │
│                            │ consumed by                                     │
│         ┌──────────────────┼──────────────────┐                             │
│         ▼                  ▼                  ▼                             │
│  ┌────────────┐   ┌────────────┐   ┌────────────┐   ┌────────────┐        │
│  │  team-a    │   │  team-b    │   │  team-c    │   │  team-d    │        │
│  │ (features) │   │ (features) │   │ (features) │   │ (features) │        │
│  └────────────┘   └────────────┘   └────────────┘   └────────────┘        │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                       @omni/mcp                                  │       │
│  │   MCPRegistry ─ global tool registry, config-driven on/off      │       │
│  │   ExternalMCPToolAdapter ─ wraps remote MCP servers (JSON-RPC)  │       │
│  │   tools/vscode/* ─ 8 built-in VS Code API tools                 │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                     controller/                                  │       │
│  │   governance-api ─ MetricsEvent ingestion via TelemetryPort     │       │
│  │   dashboard      ─ DashboardData aggregation                    │       │
│  └─────────────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Reference

### `@omni/core` — The Inner Ring

The pure contract layer. Contains **zero** IDE dependencies.

| Sub-path | Exports | Purpose |
|----------|---------|---------|
| `@omni/core` | `IDEActionPort`, `TelemetryPort` | Port interfaces every adapter must implement |
| `@omni/core/ports` | `MCPToolPort`, `MCPToolInput`, `MCPToolResult` | MCP tool contract |
| `@omni/core/domain` | `FeatureContext`, `executeFeatureAction` | Shared domain orchestration |
| `@omni/core/rpc` | `SidecarRequest`, `SidecarResponse`, `SidecarTransport` | JSON-RPC 2.0 types for sidecar comms |
| `@omni/core/errors` | `OmniError`, `PortNotImplementedError`, `SidecarConnectionError` | Typed errors |
| `@omni/core/types` | `EnvironmentId`, `TeamId`, `OmniResult<T>`, `ToolManifest` | Shared value types |
| `@omni/core/utils` | `assertNonNullable`, `isRecord`, `deepMerge` | Pure utility functions |

**Rule:** Nothing inside `@omni/core` may import from `@omni/adapters-*`, `vscode`, or any external SDK.

---

### `@omni/mcp` — MCP Tool Layer

The Model Context Protocol integration layer. All MCP tools are **project-global** — not owned by any single team.

| Sub-path | Exports | Purpose |
|----------|---------|---------|
| `@omni/mcp` | `MCPRegistry`, `ExternalMCPToolAdapter` | Core registry and external server adapter |
| `@omni/mcp/config` | `MCPConfig`, `MCPToolConfig`, `isToolEnabled` | Config schema and runtime flag checks |
| `@omni/mcp/tools` | `ExampleTool` | Built-in project-level tools |

**`MCPRegistry` lifecycle:**
```
activate()
  └─ new MCPRegistry(config)
       ├─ registry.register(new WorkspaceReadFileTool())
       ├─ registry.register(new GitStatusTool())
       └─ registry.register(new ExternalMCPToolAdapter({ toolId: 'github', ...transport }))

user/agent calls tool
  └─ registry.execute('vscode.workspace.readFile', { method: 'readFile', params: { uri } })
       ├─ isToolEnabled(config, toolId) → disabled? return error result
       └─ tool.execute(input) → MCPToolResult
```

**`ExternalMCPToolAdapter`** wraps an external MCP server (e.g. `@modelcontextprotocol/server-github`) via a `SidecarTransport` function. The external server lives outside this repo; the adapter registers it as if it were a built-in tool.

---

### Adapters

Each adapter implements `IDEActionPort` and wires up `MCPRegistry` at startup.

| Adapter | Package | Entry Point | Artifact |
|---------|---------|-------------|----------|
| VS Code | `@omni/adapters-vscode` | `activate.ts` → `vscode.ExtensionContext` | `.vsix` |
| Cursor | `@omni/adapters-cursor` | re-uses VS Code `activate` | `.vsix` |
| JetBrains | `@omni/adapters-jetbrains` | `activate.ts` → HTTP JSON-RPC server on `:7654` | `.zip` |

**JetBrains sidecar pattern:**  
Because JetBrains plugins cannot load Node.js directly, the extension ships a standalone Node.js process (the _sidecar_). The JetBrains plugin communicates with it over localhost HTTP using JSON-RPC 2.0.

```
JetBrains Plugin ──HTTP POST /rpc──▶ Node.js Sidecar (port 7654)
                                          └─ MCPRegistry.execute(...)
                ◀──JSON-RPC response──────
```

Health check: `GET http://127.0.0.1:7654/health`

---

### Teams

Each team is an isolated npm workspace package. Teams:
- Implement features by calling `IDEActionPort` methods (never importing adapter code)
- Own their API spec (`specs/openspec.json`, `specs/BMAD_doc.md`)
- Own their per-IDE extension manifests (`manifests/{vscode,cursor,jetbrains}.json`)
- Are validated independently in CI via `spec:validate`

---

### `controller/`

Central governance layer, not shipped to end users.

| Package | Purpose |
|---------|---------|
| `governance-api` | Ingests `MetricsEvent` objects from any environment via `TelemetryPort` |
| `dashboard` | Aggregates `DashboardData` for observability tooling |
| `schemas/metrics.json` | JSON Schema for telemetry event validation |

---

## Dependency Graph (simplified)

```
                    @omni/core
                   ↑    ↑    ↑
              team-*   @omni/mcp   controller
                              ↑
                    @omni/adapters-vscode
                    @omni/adapters-cursor
                    @omni/adapters-jetbrains
```

Arrows represent "depends on". No arrows point into `@omni/core` from adapters — only upward.

---

## Monorepo Build Engine: Turborepo

`turbo.json` defines the pipeline:

```json
build  → dependsOn: ["^build"]   (builds dependencies first)
test   → dependsOn: ["build"]
lint   → no deps (parallel)
spec:validate → no deps (parallel)
```

`npx turbo run build` builds the entire graph in the correct topological order, caching unchanged outputs.
