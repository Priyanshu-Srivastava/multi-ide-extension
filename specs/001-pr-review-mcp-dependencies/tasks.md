# Tasks: GitHub MCP Integration - PR Review Shared Infrastructure

**Input**: Design documents from `specs/001-pr-review-mcp-dependencies/`  
**Prerequisites**: `plan.md` (required), `spec.md` (required), `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no direct dependency)
- **[Story]**: `US1`, `US2`, `US3`, `US4`, `US5`, or `FOUNDATION`

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 [FOUNDATION] Verify required controller-pod artifact set exists in `specs/001-pr-review-mcp-dependencies/` (`spec.md`, `sceps.mc`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/`).
- [X] T002 [P] [FOUNDATION] Validate tool inventory consistency between `specs/001-pr-review-mcp-dependencies/spec.md`, `specs/001-pr-review-mcp-dependencies/openspec.json`, and `specs/001-pr-review-mcp-dependencies/contracts/*.md`.
- [X] T003 [P] [FOUNDATION] Run and verify agent-context sync via `.specify/scripts/powershell/update-agent-context.ps1 -AgentType copilot`.

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T004 [FOUNDATION] Configure GitHub MCP tool entries in `packages/mcp/mcp.config.json` for `pull_request_read`, `list_pull_requests`, `pull_request_review_write`, and `add_comment_to_pending_review` with controller-pod ownership metadata.
- [X] T005 [P] [FOUNDATION] Wire global GitHub MCP registrations in `packages/mcp/src/registry/registry.ts` and startup integration paths used by adapters.
- [X] T006 [P] [FOUNDATION] Extend shared invocation metadata contract in `packages/core/src/rpc/index.ts` and `packages/core/src/ports/mcp-port.ts` to carry `correlationId`, normalized status, and optional `retryAfter`.
- [X] T007 [FOUNDATION] Implement transient/permanent error normalization and `retryAfter` extraction in `packages/mcp/src/registry/external-adapter.ts`.
- [X] T008 [P] [FOUNDATION] Add structured log and metric hooks in `packages/mcp/src/registry/external-adapter.ts` and `packages/mcp/src/registry/registry.ts`.
- [X] T009 [FOUNDATION] Add architecture guard test preventing direct GitHub API usage outside global MCP adapters in `packages/**/__tests__/architecture/`.
- [X] T010 [P] [FOUNDATION] Add CI path-lint rule that fails when GitHub MCP tool implementations are detected under `teams/*/src` in `scripts/validate-spec.js` or a dedicated validation script under `scripts/`.
- [X] T011 [FOUNDATION] Add secrets policy check ensuring tokens are never persisted in committed config files in `scripts/` validation logic.
- [X] T012 [FOUNDATION] Add compatibility check task scaffolding for port contract stability across `teams/team-c/specs/001-pr-review-visualizer-analyzer` and `teams/team-b/specs/001-github-pr-review-comments` in `packages/core/src/ports/__tests__/compatibility/`.

**Checkpoint**: Foundation complete; user-story implementation can begin.

---

## Phase 3: User Story 1 - PR Data Available in All Three IDEs (Priority: P1) 🎯 MVP

**Goal**: Fetch PR metadata through shared ports in VS Code, Cursor, and JetBrains.

**Independent Test**: `PrReviewReadPort.fetchPullRequestContext("owner/repo", prNumber)` succeeds in all three IDE hosts.

- [X] T013 [P] [US1] Implement VS Code read transport with `X-MCP-Toolsets: pull_requests,context` and `X-MCP-Readonly: true` in `packages/adapters/vscode/src/activate.ts` or `packages/adapters/vscode/src/transports/github-read-transport.ts`.
- [X] T014 [US1] Implement OAuth-primary + PAT-fallback token acquisition in `packages/adapters/vscode/src/activate.ts`.
- [X] T015 [US1] Register read tools (`github.pull_request_read`, `github.list_pull_requests`) in `packages/adapters/vscode/src/activate.ts`, and implement explicit fallback panel/message state (`GitHub connection required`) when OAuth and PAT are both unavailable.
- [X] T016 [US1] Confirm Cursor inherits identical read behavior through `packages/adapters/cursor/src/activate.ts` and add explicit integration test under `packages/adapters/vscode/src/**/__tests__/`.
- [X] T017 [US1] Implement JetBrains baseline read forwarding path (`tools/call` for `pull_request_read`) in `packages/adapters/jetbrains/src/index.ts`.
- [X] T018 [US1] Add adapter integration tests for PR context fetch in VS Code and JetBrains, including fallback UI state assertion when credentials are unavailable, under `packages/adapters/vscode/src/**/__tests__/` and `packages/adapters/jetbrains/src/**/__tests__/`.
- [X] T019 [US1] Add latency assertion test for SC-001 (`<=5s` for normal PR fetch) in `packages/adapters/vscode/src/**/__tests__/performance/` and JetBrains equivalent.

**Checkpoint**: PR metadata retrieval works and meets latency targets in all three IDEs.

---

## Phase 4: User Story 2 - Changed Files and Diffs Retrievable (Priority: P1)

**Goal**: Retrieve changed files, diffs, and flow-node data through read contracts.

**Independent Test**: `fetchChangedFiles` and `fetchFlowNodes` return valid outputs with pagination/binary-file handling.

- [X] T020 [P] [US2] Implement mapping for `pull_request_read` methods `get_files` and `get_diff` in read orchestration paths using `packages/core/src/ports/pr-review-ports.ts`.
- [X] T021 [US2] Implement `PrReviewReadPort.fetchFlowNodes` projection logic and mapping tests in `packages/core/src/**` and `packages/mcp/src/**/__tests__/`.
- [X] T022 [US2] Implement robust parsing for mixed JSON/text MCP payloads in `packages/mcp/src/registry/external-adapter.ts`.
- [X] T023 [US2] Add pagination and empty-page behavior tests in `packages/mcp/src/**/__tests__/`.
- [X] T024 [US2] Add binary-file patch-null handling test in `packages/mcp/src/**/__tests__/`.
- [X] T025 [US2] Add changed-file and flow-node contract tests aligned with `specs/001-pr-review-mcp-dependencies/contracts/github-pr-read.md`.

**Checkpoint**: Read path fully covers PR context, changed files, diffs, and flow-node projection.

---

## Phase 5: User Story 3 - Review Comments Can Be Submitted (Priority: P2)

**Goal**: Submit line-level comments with reliable pending-review workflow.

**Independent Test**: create pending -> add comment -> submit pending -> comment is visible via read API.

- [X] T026 [P] [US3] Implement VS Code/Cursor write transport without read-only header in `packages/adapters/vscode/src/activate.ts` or `packages/adapters/vscode/src/transports/github-write-transport.ts`.
- [X] T027 [US3] Register write tools (`github.pull_request_review_write`, `github.add_comment_to_pending_review`) in `packages/adapters/vscode/src/activate.ts`.
- [X] T028 [US3] Implement `PrReviewWritePort.submitLineComment` orchestration in global integration paths under `packages/mcp/src/` using `specs/001-pr-review-mcp-dependencies/contracts/github-review-write.md`.
- [X] T029 [US3] Add invalid-line/path failure preservation tests in `packages/adapters/vscode/src/**/__tests__/`.
- [X] T030 [US3] Add explicit read-only misroute guard test in `packages/mcp/src/**/__tests__/`.
- [X] T031 [US3] Add end-to-end roundtrip test (create/add/submit then `get_review_comments` assertion) in `packages/adapters/vscode/src/**/__tests__/integration/`.

**Checkpoint**: Comment submission flow passes and is verifiable via subsequent reads.

---

## Phase 6: User Story 4 - Review Threads Viewable and Resolvable (Priority: P2)

**Goal**: Read thread states and resolve/unresolve from IDE.

**Independent Test**: Thread list reflects state changes after resolve/unresolve calls.

- [X] T032 [P] [US4] Implement read mapping for `get_review_comments` and `get_reviews` in `packages/mcp/src/registry/external-adapter.ts` and read orchestration paths.
- [X] T033 [US4] Implement write mapping for `resolve_thread` and `unresolve_thread` in `packages/mcp/src/` integration paths.
- [X] T034 [US4] Add `threadId` required validation tests and idempotent behavior tests in `packages/mcp/src/**/__tests__/`.
- [X] T035 [US4] Add integration test verifying updated thread state is returned after write operation in `packages/adapters/vscode/src/**/__tests__/integration/`.

**Checkpoint**: Thread lifecycle operations are stable and contract-compliant.

---

## Phase 7: User Story 5 - JetBrains Sidecar Bridge Implemented (Priority: P3)

**Goal**: Replace stub with production JetBrains sidecar bridge and host parity.

**Independent Test**: `POST /rpc` forwards valid `tools/call` requests; sidecar handles startup, timeout, and restart behavior correctly.

- [X] T036 [P] [US5] Replace `JetBrainsSidecarBridge` stub with production implementation in `packages/adapters/jetbrains/src/index.ts`.
- [X] T037 [US5] Enforce pinned Docker image invocation (`ghcr.io/github/github-mcp-server:v1.0.3`) in `packages/adapters/jetbrains/src/index.ts`.
- [X] T038 [US5] Implement single-process lifecycle with one automatic restart and 30-second per-call timeout in `packages/adapters/jetbrains/src/index.ts`.
- [X] T039 [US5] Implement missing-auth handling with HTTP 401 path in `packages/adapters/jetbrains/src/activate.ts`.
- [X] T040 [US5] Add sidecar tests for startup, timeout, restart, parse error, and pinned-image command construction in `packages/adapters/jetbrains/src/**/__tests__/`.
- [X] T041 [US5] Add concurrency test asserting 10 parallel RPC calls complete without dropped responses in `packages/adapters/jetbrains/src/**/__tests__/performance/`.
- [X] T042 [US5] Add `/health` endpoint test for registered-tool consistency in `packages/adapters/jetbrains/src/**/__tests__/`.

**Checkpoint**: JetBrains production bridge reaches parity with VS Code/Cursor expectations.

---

## Phase 8: Observability and Cross-Cutting

- [X] T043 [P] [FOUNDATION] Emit structured logs with required fields (`toolId`, `ide`, `operation`, `status`, `durationMs`, `errorCode`, `correlationId`) in adapter, registry, and sidecar call paths.
- [X] T044 [P] [FOUNDATION] Emit metrics (`calls_total`, `success_total`, `failure_total`, `timeout_total`, `latency_p95`) in `packages/mcp/src/` and `packages/telemetry/src/` integration points.
- [X] T045 [FOUNDATION] Implement and test `correlationId` propagation adapter -> registry -> sidecar with >=95% coverage assertion in integration tests.
- [X] T046 [FOUNDATION] Update `specs/001-pr-review-mcp-dependencies/quickstart.md` with observability verification procedure and expected outputs.

---

## Phase 9: Validation and Release Readiness

- [X] T047 [FOUNDATION] Run `node scripts/validate-spec.js` and record pass result.
- [X] T048 [FOUNDATION] Run `npm run build` and resolve all build failures in changed workspaces.
- [X] T049 [FOUNDATION] Run `npm run lint` and resolve all lint failures in changed workspaces.
- [X] T050 [FOUNDATION] Execute targeted test suites for `packages/mcp`, `packages/adapters/vscode`, and `packages/adapters/jetbrains`.
- [X] T051 [FOUNDATION] Execute path-lint/secrets-policy checks added in T010-T011 and record pass output.
- [X] T052 [FOUNDATION] Run contract compatibility checks across at least two consumers and record non-breaking result for `packages/core/src/ports/`.
- [ ] T053 [FOUNDATION] Run setup-time usability walkthrough from `quickstart.md` and confirm SC-007 (`<10 minutes`) on all three IDE paths.
- [X] T054 [FOUNDATION] Update release notes/changelog entries for global GitHub MCP integration changes.

---

## Dependencies & Execution Order

1. Complete Setup and Foundational phases first (T001-T012).
2. US1 and US2 are the first executable delivery slice.
3. US3 and US4 depend on stable read-path behavior from US1/US2.
4. US5 can run in parallel with US3/US4 after foundation but must complete before final validation.
5. Observability phase (T043-T046) begins once at least one host path is functional and must complete before validation closure.
6. Validation phase (T047-T054) is mandatory before merge readiness.

## Parallel Opportunities

- T005, T006, T008, T010 can run in parallel.
- T013 and T014 can run in parallel.
- T020 and T022 can run in parallel.
- T026 and T028 can run in parallel.
- T036 and T039 can run in parallel.
- T043 and T044 can run in parallel.

## Implementation Strategy

### MVP First

1. Complete T001-T012.
2. Deliver US1 and US2 (T013-T025).
3. Validate cross-IDE read path and latency target.

### Incremental Delivery

1. Add US3 write flow.
2. Add US4 thread lifecycle support.
3. Add US5 JetBrains production bridge hardening.
4. Complete observability and final validation gates.
