# Implementation Plan: PR Review Visualizer and Analyzer

**Branch**: `[001-pr-review-visualizer-analyzer]` | **Date**: 2026-04-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/teams/team-c/specs/001-pr-review-visualizer-analyzer/spec.md`

## Summary

Build a flow-aware PR review experience that loads GitHub pull request changes through global MCP capabilities, renders one file at a time in deterministic graph order, generates per-hunk AI analysis, and lets reviewers submit line comments directly from the UI.

The implementation follows hexagonal architecture: domain traversal and analysis orchestration in core-facing layers, adapter-specific UI/rendering in IDE adapters, and MCP interactions through global ports/registry paths only.

Companion global dependency spec: `specs/001-pr-review-mcp-dependencies/spec.md` (owned by MCP/platform team, review artifact only).

Execution boundary: this plan is Team-C execution only. Global MCP platform work is dependency input and not implemented via this team plan.

## Technical Context

**Language/Version**: TypeScript 5.6, Node.js 20+  
**Primary Dependencies**: `@omni/core`, `@omni/mcp`, `@omni/adapters-vscode`, VS Code extension API surface in adapter layer  
**Storage**: In-memory review session state (tab traversal state, drafts, snapshot metadata); no persistent database for v1  
**Testing**: Workspace lint/typecheck plus unit tests for domain traversal and mapping logic; adapter contract tests for MCP interaction boundaries  
**Target Platform**: Multi-IDE extension platform with initial UX delivery in VS Code adapter  
**Project Type**: Monorepo extension platform feature across shared packages + team orchestration  
**Performance Goals**: First review screen ready within 30s for PRs up to 100 changed text files; deterministic navigation with no reordering jitter  
**Constraints**: Hexagonal boundaries, global MCP tooling only, no team-private MCP tools, deterministic DFS traversal, robust rate-limit/error handling  
**Scale/Scope**: Single reviewer session, PRs with up to 100 changed text files, code/test tab partitioning

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| Hexagonal architecture | PASS | Domain logic isolated from adapter implementations; plan keeps dependency flow inward. |
| Boundary rule (no direct IDE SDK in domain/team core logic) | PASS | IDE-specific code remains inside adapter packages. |
| MCP tool model global (not team-owned) | PASS | MCP tools/contracts/registry changes restricted to `packages/mcp` and `packages/core` contracts. |
| MCP companion global dependency spec | PASS | Shared MCP dependency work is split to `specs/001-pr-review-mcp-dependencies/`. |
| Team isolation and spec path contract | PASS | Feature artifacts remain under `teams/team-c/specs/001-pr-review-visualizer-analyzer/`. |
| Spec-first delivery | PASS | Plan derived from approved spec before implementation tasks. |

## Project Structure

### Documentation (this feature)

```text
teams/team-c/specs/001-pr-review-visualizer-analyzer/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── pr-review-inbound.md
│   └── github-mcp-outbound.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/
├── core/
│   └── src/
│       ├── domain/
│       │   └── pr-review/                  # traversal + mapping domain services
│       ├── ports/
│       │   └── pr-review-ports.ts          # inbound/outbound port contracts
│       └── types/
│           └── pr-review-types.ts          # shared value objects
├── mcp/
│   └── src/
│       ├── registry/                       # registration/config wiring for GitHub MCP usage
│       └── config/                         # enablement and tool configuration
└── adapters/
    └── vscode/
        └── src/
            ├── services/pr-review/         # adapter-side orchestration and state bridge
            └── mcp-tools/vscode/           # existing VS Code workspace tools consumed by feature

teams/
└── team-c/
    └── src/
        └── features/                       # feature composition/orchestration only; no MCP tool implementations
```

**Structure Decision**: Use shared global packages for domain, ports, and MCP integration points, with team-c feature code acting as orchestration/composition. This satisfies AC-001..AC-007 and avoids team-specific tool ownership.

## Implementation Phases

### Phase -1: Cross-Team Dependency Gate (Global MCP Team)

- Complete global dependency specification review in `specs/001-pr-review-mcp-dependencies/spec.md`.
- Confirm shared MCP contract/registry decisions are approved by global MCP owners for team consumption.

### Ownership Matrix

- **Team-C executes**: Team feature orchestration, reviewer flow behavior, adapter usage integration, UI state behavior, testing in Team-C delivery scope.
- **Team-C does not execute here**: MCP tool creation, MCP registry/config implementation, shared MCP contract authoring in global scope.
- **Global team artifact consumed**: `specs/001-pr-review-mcp-dependencies/spec.md`

### Phase 0: Research and Validation

- Finalize entry-point inference signals and deterministic tie-break rules.
- Validate diff line mapping constraints against GitHub MCP comment payload requirements.
- Confirm classification heuristics for test files and cycle behavior edge cases.
- Confirm companion global dependency deliverables are available before final adapter integration.

### Phase 1: Domain and Contract Design

- Define value objects: PullRequestContext, ChangedFile, FlowNode, DiffHunk, TraversalState, ReviewCommentDraft.
- Define Team-C feature interfaces for review session operations (load, next, previous, switch tab, draft save, submit comment).
- Consume approved global outbound MCP contracts for PR data retrieval and review comment submission.
- Document contract-level failure modes (rate limit, missing line mapping, stale snapshot).

### Phase 2: Core Logic Implementation

- Implement deterministic DFS traversal service with cycle-safe visited tracking.
- Implement entry-point selector with override + confidence + lexical tie-break.
- Implement tab-isolated traversal state and resume semantics.
- Implement hunk identity and traceability mapping to support AI insights and comments.

### Phase 3: Adapter Integration (VS Code First)

- Build one-file-at-a-time diff page rendering pipeline in adapter service layer.
- Integrate approved global MCP capabilities for PR read and comment write operations.
- Attach AI analysis blocks to each displayed hunk with low-risk explicit state.
- Add draft persistence and retry UX behavior for failed comment posts.
- Do not add MCP tool implementation files under team paths; consume global capabilities only.

### Phase 4: Quality, Verification, and Readiness

- Add unit coverage for traversal determinism, cycle handling, and mapping integrity.
- Add integration-level validation for MCP error handling and comment posting mapping.
- Validate success criteria targets via benchmark scenarios (20-file and 100-file PR cases).

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Entry-point inference ambiguity | Medium | Keep manual override mandatory and deterministic fallback ordering. |
| GitHub MCP rate limits or transient failures | High | Add retry strategy, clear user feedback, and snapshot-preserving recovery. |
| Diff line mapping mismatches | High | Maintain explicit hunk identity model and pre-submit mapping validation. |
| Graph cycles in real-world codebases | Medium | Enforce visited-set traversal logic and branch backtracking safeguards. |

## Complexity Tracking

No constitution violations identified. Complexity exceptions are not required.
