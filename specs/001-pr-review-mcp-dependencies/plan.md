# Implementation Plan: GitHub MCP Integration - PR Review Shared Infrastructure

**Branch**: `001-pr-review-mcp-dependencies` | **Date**: 2026-04-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/001-pr-review-mcp-dependencies/spec.md`

## Summary

Deliver controller-pod-owned, global GitHub MCP integration infrastructure for PR review across VS Code, Cursor, and JetBrains by wiring shared ports to GitHub MCP tools through `ExternalMCPToolAdapter`, implementing a production JetBrains sidecar bridge, enforcing authentication and error-handling contracts, and adding observability (logs + metrics + correlation tracing) without violating hexagonal boundaries.

## Technical Context

**Language/Version**: TypeScript 5.6, Node.js 20+  
**Primary Dependencies**: `@omni/core`, `@omni/mcp`, `@omni/adapters-vscode`, `@omni/adapters-jetbrains`, GitHub MCP server `ghcr.io/github/github-mcp-server:v1.0.3`  
**Storage**: N/A (stateless transport and in-memory process/session state only)  
**Testing**: workspace build/lint/typecheck, adapter unit tests, MCP contract/integration tests, spec validation (`node scripts/validate-spec.js`)  
**Target Platform**: VS Code 1.101+, Cursor (VS Code-compatible), JetBrains sidecar host  
**Project Type**: Monorepo extension platform (shared core + adapters + global MCP package)  
**Performance Goals**: PR context fetch <= 5s end-to-end; JetBrains first-call boot <= 10s where image already present; write/comment roundtrip <= 5s p95  
**Constraints**: Hexagonal architecture, no team-local MCP tools, OAuth primary for VS Code/Cursor, PAT fallback for all, JetBrains Docker stdio bridge, 30s per-RPC timeout, structured observability with `correlationId`  
**Scale/Scope**: 4 in-scope GitHub tools (`pull_request_read`, `pull_request_review_write`, `add_comment_to_pending_review`, `list_pull_requests`), 3 IDE hosts, global reusable contracts for team consumers

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| Hexagonal architecture (2.1) | PASS | Domain depends on ports only; adapters implement transport integration. |
| Boundary rule (2.2) | PASS | No direct IDE SDK imports in core domain logic; IDE SDK remains adapter-scoped. |
| MCP tool model global (2.3) | PASS | GitHub MCP tools are implemented only in global `packages/mcp` integration paths. |
| Team ownership and global scope (3.1, 3.2) | PASS | Feature lives in `specs/<feature>/` for controller-pod global delivery. |
| Required files for global execution (3.3) | PASS | `spec.md`, `sceps.mc`, `plan.md`, `tasks.md` present/produced in this run. |
| Spec-first delivery (4.1) | PASS | Spec and clarification completed prior to implementation planning. |
| Required quality gates (5.1) | PASS | Plan includes `node scripts/validate-spec.js`, build, lint, test gates. |
| Security and secrets (8) | PASS | PAT/env-only secret policy enforced; no token persistence in committed files. |

### Post-Design Re-check

After Phase 1 artifact generation, the same gates remain **PASS**. Design artifacts maintain global ownership boundaries, hexagonal direction, and secret-handling constraints.

## Project Structure

### Documentation (this feature)

```text
specs/001-pr-review-mcp-dependencies/
├── spec.md
├── sceps.mc
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── openspec.json
├── contracts/
│   ├── github-pr-read.md
│   ├── github-review-write.md
│   ├── transport-vscode.md
│   └── transport-jetbrains.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/
├── core/
│   └── src/
│       ├── ports/
│       │   ├── mcp-port.ts
│       │   └── pr-review-ports.ts
│       ├── rpc/
│       │   └── index.ts
│       └── types/
├── mcp/
│   ├── mcp.config.json
│   └── src/
│       └── registry/
│           ├── external-adapter.ts
│           └── registry.ts
└── adapters/
    ├── vscode/
    │   └── src/
    │       └── activate.ts
    ├── cursor/
    │   └── src/
    │       └── activate.ts
    └── jetbrains/
        └── src/
            ├── activate.ts
            └── index.ts
```

**Structure Decision**: Maintain shared global implementation in `packages/*` and avoid any MCP tool implementation in team folders. IDE-specific transport details stay adapter-local; contract and domain boundaries remain in `packages/core` and `packages/mcp`.

## Phase 0: Research Consolidation

- Confirm all prior decisions in `research.md` map to current clarified spec requirements (including observability).
- Verify no unresolved `NEEDS CLARIFICATION` items remain in `spec.md`.
- Confirm in-scope GitHub MCP tools and method variants match v1.0.3 source and contract docs.

## Phase 1: Design and Contracts

- Produce `data-model.md` for core entities and state transitions.
- Finalize/validate `contracts/` for read/write tool calls and per-IDE transport behavior.
- Produce `quickstart.md` with reproducible setup and smoke-test flow for all three IDEs.
- Update Copilot agent context with current technology choices via `.specify/scripts/powershell/update-agent-context.ps1 -AgentType copilot`.

## Phase 2: Implementation Planning Scope

- VS Code/Cursor transport integration and tool registration in adapter activation.
- JetBrains sidecar bridge production implementation (process lifecycle, handshake, timeout, restart).
- Global MCP config/tool enablement updates with controller-pod ownership metadata.
- Error normalization and observability propagation (`correlationId`, metrics, structured logs).
- Validation and release-readiness gates.

## Risk Tracking and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| JetBrains bridge process instability | High | Single managed process, one automatic restart, deterministic timeout handling, integration tests. |
| Auth mismatch across IDE hosts | High | OAuth-first + PAT fallback policy, startup checks, explicit error messages and health endpoints. |
| Rate limiting / API instability | Medium | Standardized transient vs permanent error mapping and retry guidance. |
| Scope creep into team-owned implementation | Medium | Keep all MCP adapters/contracts in global packages and enforce with task boundaries + review checklist. |
| Observability gaps across layers | Medium | Enforce correlation propagation through adapter -> registry -> sidecar and validate in tests. |

## Complexity Tracking

No constitution violations identified; no exceptions required.
