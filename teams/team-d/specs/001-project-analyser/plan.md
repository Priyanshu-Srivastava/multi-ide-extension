# Implementation Plan: Project Analyser

**Branch**: `001-project-analyser` | **Date**: 2026-04-25 | **Spec**: `teams/team-d/specs/001-project-analyser/spec.md`
**Input**: Feature specification from `/teams/team-d/specs/001-project-analyser/spec.md`

## Summary

Build a Team D VS Code feature that analyzes the active workspace and produces a structured, readable, sectioned report with Mermaid diagrams for architecture and flows. The implementation must keep orchestration in Team D feature code, route analysis operations through shared MCP/core tooling, enforce JSON-RPC IPC contracts between UI and runtime, and surface globally reusable tooling gaps instead of creating Team D-only workarounds.

## Technical Context

**Language/Version**: TypeScript (strict mode), Node.js 20+ runtime baseline  
**Primary Dependencies**: `@omni/core`, `@omni/adapters-vscode`, `@omni/mcp`, VS Code Extension API, registered MCP tools, configured LLM provider via core LLM port  
**Storage**: N/A (ephemeral analysis over workspace files; no persistent feature datastore)  
**Testing**: TypeScript build validation (`tsc -b`), targeted unit tests in `teams/team-d/src/tests/`, manual extension flow verification in VS Code  
**Target Platform**: VS Code extension host (Team D package)  
**Project Type**: Monorepo TypeScript extension feature module  
**Performance Goals**: Standard-depth run completes within 120 seconds in representative repositories; stage progress emitted throughout run  
**Constraints**: Must use shared MCP/core abstractions where equivalent capability exists; no direct bypass calls; JSON-RPC message envelope for panel IPC; redact secrets in output  
**Scale/Scope**: Full-workspace default analysis with depth modes (`shallow`, `standard`, `deep`); report sections for overview, architecture, business flows, code analysis, deployment

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

1. **Hexagonal Architecture (PASS PLAN)**
  - Keep Team D feature logic in `teams/team-d/src/features/project-analyser/`.
  - Depend on `@omni/core` ports/contracts and shared adapter abstractions only.

2. **Boundary Rule (PASS PLAN)**
  - Domain-style analysis orchestration and report shaping stay in Team D feature modules.
  - IDE SDK access limited to extension-facing panel wiring; no IDE-SDK leakage into shared domain contracts.

3. **MCP Tool Model (PASS PLAN)**
  - Workspace reads, discovery, diagnostics, and similar operations route through registered MCP tools / common wrappers.
  - If a required reusable capability is missing, raise a global tooling gap (core/common scope), do not implement Team D-only substitute.

4. **Spec-First Delivery (PASS)**
  - Feature spec exists at `teams/team-d/specs/001-project-analyser/spec.md` and drives this plan.

5. **Team Isolation (PASS PLAN)**
  - Feature implementation contained under Team D package paths.
  - Cross-package edits only for explicit shared-contract evolution when globally required.

6. **CI/Quality Gates (REQUIRED BEFORE MERGE)**
  - Run `node scripts/validate-spec.js`.
  - Run monorepo build (`npm run build`).
  - Run Team D lint/test/build commands.

## Project Structure

### Documentation (this feature)

```text
teams/team-d/specs/001-project-analyser/
├── plan.md
├── research.md
├── tasks.md
├── spec.md
├── openspec.json
├── checklists/
│   └── requirements.md
├── data-model.md        # to be created in /speckit.plan outputs if needed
├── quickstart.md        # to be created in /speckit.plan outputs if needed
└── contracts/           # to be created in /speckit.plan outputs if needed
```

### Source Code (repository root)

```text
teams/team-d/src/
├── features/
│   ├── index.ts
│   ├── math-panel.ts
│   └── project-analyser/
│       ├── index.ts
│       ├── ipc-contract.ts
│       ├── project-analysis-service.ts
│       └── analysis-panel.ts
├── tests/
│   └── ...
└── index.ts

packages/core/src/
├── domain/
│   └── analysis.ts            # shared report contracts
├── ports/
│   ├── analysis-port.ts
│   ├── llm-port.ts
│   └── mcp-port.ts
└── rpc/
   └── index.ts               # JSON-RPC message contracts

packages/adapters/vscode/src/
├── activate.ts                # accessors + command wiring
├── services/
│   └── workspace-reader.ts    # MCP-backed shared reader wrapper
└── llm/
   └── ...
```

**Structure Decision**: Use existing monorepo extension-module structure. Team D owns analysis orchestration/UI, while shared contracts and tool wrappers stay in `packages/core` and `packages/adapters/vscode`. Any newly discovered cross-team capability gap is documented for shared-layer implementation instead of local feature-only code.

## Delivery Phases

### Phase 0: Alignment And Gap Discovery

- Validate spec and constitution compliance against current code.
- Enumerate required capabilities and map each to existing shared MCP/core/common tooling.
- Produce a global tooling-gap list for any missing reusable capability (no local workaround coding).

### Phase 1: Contracts And Data Model Finalization

- Finalize analysis report model and IPC payload contracts used by panel and service.
- Confirm strict structured output schema including Mermaid fields, confidence/limitations, and redaction behavior.

### Phase 2: Feature Orchestration And UI Integration

- Implement Team D analysis service orchestration against shared tools and LLM port.
- Implement panel flow with staged progress and sectioned rendering.
- Ensure JSON-RPC request/response correlation and structured errors.

### Phase 3: Validation And Hardening

- Validate tool-routing conformance (no bypasses for existing shared capabilities).
- Validate redaction behavior and fallback handling for missing/partial context.
- Validate timing and success criteria with representative repositories.

### Phase 4: Merge Readiness

- Run spec validation, lint/build/tests, and manual acceptance walkthrough.
- Record unresolved global tooling gaps for shared backlog ownership.

## Complexity Tracking

No constitutional violations planned.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
