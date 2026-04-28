# Tasks: PR Review Visualizer and Analyzer

**Input**: Design documents from `/teams/team-c/specs/001-pr-review-visualizer-analyzer/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Cross-Team Dependency**: Requires global MCP dependency spec review/approval in `/specs/001-pr-review-mcp-dependencies/spec.md` before Team-C adapter integration.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no direct dependency)
- **[Story]**: `US1`, `US2`, `US3`, `US4`, or `FOUNDATION`

## Phase 0: Cross-Team Dependency Gate (Blocking)

- [X] T001 [FOUNDATION] Confirm companion global spec artifacts exist in `specs/001-pr-review-mcp-dependencies/`.
- [ ] T002 [FOUNDATION] Confirm global MCP dependency decisions in `specs/001-pr-review-mcp-dependencies/spec.md` are approved by global MCP owners.

## Phase 1: Team-C Foundations (Blocking)

- [X] T003 [P] [FOUNDATION] Define Team-C feature composition entry points in `teams/team-c/src/features/index.ts`.
- [X] T004 [P] [FOUNDATION] Create Team-C PR review orchestration module scaffold in `teams/team-c/src/features/pr-review-visualizer.ts`.
- [X] T005 [FOUNDATION] Wire Team-C feature to consume approved global PR review contracts (no contract authoring) in `teams/team-c/src/features/pr-review-visualizer.ts`.
- [X] T006 [FOUNDATION] Add Team-C runtime validation for required global dependency approvals before feature activation in `teams/team-c/src/features/pr-review-visualizer.ts`.
- [X] T029 [FOUNDATION] Implement PR metadata retrieval orchestration path for session startup in `teams/team-c/src/features/pr-review-visualizer.ts`.
- [X] T030 [FOUNDATION] Implement diff hunk retrieval and mapping verification path before rendering in `packages/adapters/vscode/src/services/pr-review/diff-render-model.ts`.

## Phase 2: User Story 1 - Flow-Based PR Traversal (P1)

**Goal**: Deterministic, one-file-at-a-time traversal in graph order with entry-point logic.

**Independent Test**: Load a multi-file PR and validate stable entry-point + recursive DFS traversal with backtracking.

- [X] T007 [P] [US1] Implement entry-point selection service with override and deterministic tie-break in `packages/core/src/domain/pr-review/entry-point-selector.ts`.
- [X] T008 [P] [US1] Implement cycle-safe DFS traversal service in `packages/core/src/domain/pr-review/traversal-service.ts`.
- [X] T009 [US1] Implement per-tab traversal state manager in `packages/core/src/domain/pr-review/traversal-state.ts`.
- [X] T010 [US1] Integrate traversal services into Team-C orchestration in `teams/team-c/src/features/pr-review-visualizer.ts`.
- [X] T011 [US1] Add adapter read-model for current node, parent, and remaining branches in `packages/adapters/vscode/src/services/pr-review/navigation-view-model.ts`.
- [X] T012 [US1] Add unit tests for deterministic traversal and cycle handling in `packages/core/src/domain/pr-review/__tests__/traversal-service.test.ts`.

## Phase 3: User Story 2 - Per-Change AI Analysis (P2)

**Goal**: PR-style diff rendering with complete AI hunk insights.

**Independent Test**: Open a changed file and verify each visible hunk includes required analysis fields and traceability.

- [X] T013 [P] [US2] Implement hunk identity and trace mapping service in `packages/core/src/domain/pr-review/hunk-traceability.ts`.
- [X] T014 [P] [US2] Implement AI analysis envelope model in `packages/core/src/types/pr-review-types.ts`.
- [X] T015 [US2] Build adapter service to attach analysis to each displayed hunk in `packages/adapters/vscode/src/services/pr-review/hunk-analysis-service.ts`.
- [X] T016 [US2] Implement PR-style diff line color rendering model in `packages/adapters/vscode/src/services/pr-review/diff-render-model.ts`.
- [X] T017 [US2] Add tests for analysis completeness and low-risk explicit state in `packages/adapters/vscode/src/services/pr-review/__tests__/hunk-analysis-service.test.ts`.

## Phase 4: User Story 3 - In-Context PR Commenting (P3)

**Goal**: Post line-level comments from UI with robust failure handling.

**Independent Test**: Submit and verify line comments on PR; on failure, draft remains and retry works.

- [X] T018 [P] [US3] Implement comment draft state model and persistence in `packages/core/src/domain/pr-review/comment-draft-service.ts`.
- [X] T019 [P] [US3] Implement line-target mapping validator in `packages/core/src/domain/pr-review/comment-target-validator.ts`.
- [X] T020 [US3] Implement adapter comment submission orchestration in `packages/adapters/vscode/src/services/pr-review/comment-submit-service.ts`.
- [X] T021 [US3] Add retry and error feedback states in `packages/adapters/vscode/src/services/pr-review/comment-submit-state.ts`.
- [X] T022 [US3] Add integration tests for submission success/failure mapping behavior in `packages/adapters/vscode/src/services/pr-review/__tests__/comment-submit-service.test.ts`.

## Phase 5: User Story 4 - Test Files Separation (P4)

**Goal**: Separate Code and Tests tabs with independent traversal state.

**Independent Test**: Switch tabs and verify state isolation and resume behavior.

- [X] T023 [P] [US4] Implement file classification rules (Code/Test) in `packages/core/src/domain/pr-review/file-classifier.ts`.
- [X] T024 [US4] Implement tab switch/resume adapter behavior in `packages/adapters/vscode/src/services/pr-review/tab-state-service.ts`.
- [X] T025 [US4] Add tests for tab isolation and resume behavior in `packages/core/src/domain/pr-review/__tests__/tab-state.test.ts`.

## Phase 5.1: Resume and Recovery Coverage

- [X] T031 [US4] Implement review resume-after-interruption behavior using saved session state in `packages/core/src/domain/pr-review/traversal-state.ts`.
- [X] T032 [US4] Add tests for interruption resume behavior in `packages/core/src/domain/pr-review/__tests__/resume-state.test.ts`.

## Phase 6: Polish, Compliance, and Validation

- [X] T026 [P] [FOUNDATION] Add cross-reference note in team spec confirming companion global dependency completion in `teams/team-c/specs/001-pr-review-visualizer-analyzer/spec.md`.
- [X] T027 [FOUNDATION] Run spec validation and capture result (`node scripts/validate-spec.js`).
- [X] T028 [FOUNDATION] Run workspace build/lint gates (`npm run build`, `npm run lint`) and record outcomes in implementation PR.

## Out of Scope for Team-C Task Execution

- MCP tool creation or modification in global shared packages.
- MCP registry/config implementation owned by global MCP team.
- Shared MCP contract authoring owned by global MCP team.

## Dependency Order

1. Complete T001-T002 before any Team-C implementation tasks.
2. Complete T001 before core Team-C implementation tasks.
3. T002 is required before adapter integration tasks T015, T016, T020, T021, T024.
4. Complete T003-T006, T029-T030 before US tasks.
5. Deliver US1 before US2 and US3 integration.
6. US4 can begin after T009 (tab state foundation) is complete.
7. Complete T026-T028 before merge readiness.

## Plan-to-Task Mapping

- Phase -1 Cross-Team Dependency Gate -> T001-T002
- Phase 0 Research and Validation -> T001-T002, T006
- Phase 1 Domain and Contract Design -> T003-T006
- Phase 1 Domain and Contract Design -> T003-T006, T029-T030
- Phase 2 Core Logic Implementation -> T007-T014, T018-T019, T023, T031
- Phase 3 Adapter Integration -> T010-T011, T015-T016, T020-T021, T024
- Phase 4 Quality and Readiness -> T012, T017, T022, T025-T028, T032
