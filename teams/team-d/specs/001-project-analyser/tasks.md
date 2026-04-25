# Tasks: Project Analyser

**Input**: Design documents from `/teams/team-d/specs/001-project-analyser/`
**Prerequisites**: plan.md (required), spec.md (required), research.md

**Tests**: Include focused validation tasks to verify acceptance criteria and architecture conformance.

**Organization**: Tasks are grouped by user story so each story remains independently deliverable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency chain)
- **[Story]**: US1, US2, US3, or Shared
- Include exact file paths in each task

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish feature scaffolding and baseline wiring for Team D.

- [X] T001 [Shared] Create/confirm project analyser feature module barrel exports in `teams/team-d/src/features/project-analyser/index.ts` and `teams/team-d/src/features/index.ts`
- [X] T002 [Shared] Add/confirm command wiring contract for Project Analyser feature in `packages/adapters/vscode/src/activate.ts` (Team D command registration only)
- [X] T003 [P] [Shared] Confirm Team D package dependencies for shared tooling in `teams/team-d/package.json` (`@omni/core`, `@omni/adapters-vscode`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build shared-contract compliance and non-negotiable foundations before user stories.

**CRITICAL**: No user story implementation starts before this phase is complete.

- [X] T004 [Shared] Finalize strict IPC payload contracts in `teams/team-d/src/features/project-analyser/ipc-contract.ts` using JSON-RPC envelope semantics from `packages/core/src/rpc/index.ts`
- [X] T005 [Shared] Finalize analysis service contract alignment with `ProjectAnalysisPort` in `packages/core/src/ports/analysis-port.ts` and Team D service signatures in `teams/team-d/src/features/project-analyser/project-analysis-service.ts`
- [X] T006 [Shared] Enforce MCP/core tool-routing baseline in `teams/team-d/src/features/project-analyser/project-analysis-service.ts` by using shared abstractions (`WorkspaceReader`, core ports) for workspace/diagnostics operations
- [X] T007 [P] [Shared] Add reusable redaction utility for analysis output sanitization in `teams/team-d/src/features/project-analyser/project-analysis-service.ts` (or local helper module in same folder)
- [X] T008 [Shared] Add confidence + limitation section model mapping in `teams/team-d/src/features/project-analyser/project-analysis-service.ts` to satisfy FR-016/SC-007
- [X] T009 [Shared] Add global tooling-gap reporting structure (`Global Tooling Gap Report`) in `teams/team-d/src/features/project-analyser/project-analysis-service.ts` and include in report assembly path
- [X] T010 [Shared] Add architecture conformance guard comments/checkpoints in `teams/team-d/src/features/project-analyser/project-analysis-service.ts`, `teams/team-d/src/features/project-analyser/analysis-panel.ts`, and `teams/team-d/src/features/project-analyser/ipc-contract.ts` to prevent direct bypass calls

**Checkpoint**: Shared contracts, MCP routing baseline, redaction, and gap-escalation foundations are complete.

---

## Phase 3: User Story 1 - Generate End-to-End Project Report (Priority: P1)

**Goal**: Produce a complete, structured project report with architecture, deployment, business flow, and code sections.

**Independent Test**: Run one analysis from panel and verify all mandatory report sections plus Mermaid diagrams are present.

### Implementation for User Story 1

- [X] T011 [US1] Implement architecture context gathering and summarization path in `teams/team-d/src/features/project-analyser/project-analysis-service.ts`
- [X] T012 [US1] Implement deployment strategy extraction and structured output mapping in `teams/team-d/src/features/project-analyser/project-analysis-service.ts`
- [X] T013 [US1] Implement business-flow extraction with stepwise flow output in `teams/team-d/src/features/project-analyser/project-analysis-service.ts`
- [X] T014 [US1] Implement code-behavior section (conditions, error patterns, use cases) in `teams/team-d/src/features/project-analyser/project-analysis-service.ts`
- [X] T015 [US1] Assemble full `ProjectReport` output schema in `teams/team-d/src/features/project-analyser/project-analysis-service.ts` including confidence, limitations, and redaction pass
- [X] T015a [US1] Implement depth-mode behavior (`shallow`, `standard`, `deep`) with explicit context-gathering differences in `teams/team-d/src/features/project-analyser/project-analysis-service.ts` (FR-008)
- [X] T015b [US1] Implement full-workspace default scope semantics with optional narrowing override in `teams/team-d/src/features/project-analyser/project-analysis-service.ts` and `teams/team-d/src/features/project-analyser/ipc-contract.ts` (FR-013)
- [X] T016 [US1] Wire analysis run request/reply in `teams/team-d/src/features/project-analyser/analysis-panel.ts` using IPC method constants and strict response typing
- [X] T017 [US1] Render overview + architecture sections in `teams/team-d/src/features/project-analyser/analysis-panel.ts` with readable organization and Mermaid fallback handling
- [X] T018 [US1] Render business-flows + deployment + code-analysis sections in `teams/team-d/src/features/project-analyser/analysis-panel.ts` with section tabs and structured lists

### Validation for User Story 1

- [X] T019 [US1] Validate single-run report completeness against FR-002 and SC-001 via manual run checklist in `teams/team-d/specs/001-project-analyser/checklists/requirements.md`
- [X] T020 [US1] Validate Mermaid render/fallback behavior for architecture and flow diagrams in `teams/team-d/src/features/project-analyser/analysis-panel.ts`
- [X] T020a [US1] Validate Mermaid renderability metric threshold (>=90% successful diagram render for successful runs) and fallback behavior evidence in `teams/team-d/specs/001-project-analyser/checklists/requirements.md` (SC-002)

**Checkpoint**: US1 independently functional and demonstrable.

---

## Phase 4: User Story 2 - Understand Complex Flows and Edge Behaviors (Priority: P2)

**Goal**: Provide high-value insights for branching logic, conditions, error paths, and multiple use cases.

**Independent Test**: Generate report on representative repo and verify distinct use cases, key conditions, and error-behavior coverage.

### Implementation for User Story 2

- [X] T021 [US2] Improve control-flow extraction prompts/logic to emphasize decision points and branch outcomes in `teams/team-d/src/features/project-analyser/project-analysis-service.ts`
- [X] T022 [US2] Add explicit error-handling pattern extraction and classification in `teams/team-d/src/features/project-analyser/project-analysis-service.ts`
- [X] T023 [US2] Enrich use-case modeling with trigger, steps, outcomes in `teams/team-d/src/features/project-analyser/project-analysis-service.ts`
- [X] T024 [US2] Update code-analysis UI section to present conditions, error patterns, and use cases clearly in `teams/team-d/src/features/project-analyser/analysis-panel.ts`
- [X] T025 [US2] Add low-confidence/limited-context messaging in report sections where inference confidence is reduced in `teams/team-d/src/features/project-analyser/analysis-panel.ts`

### Validation for User Story 2

- [X] T026 [US2] Validate at least two distinct use cases and key condition/error visibility across at least 5 representative repository runs; record results in `teams/team-d/specs/001-project-analyser/checklists/requirements.md` (SC-003 support)
- [X] T027 [US2] Validate confidence+limitations rendering in all major sections (SC-007)
- [X] T027a [US2] Run lightweight comprehension validation with at least 5 participants and architecture/flow questions; record >=85% correct-response outcome evidence in `teams/team-d/specs/001-project-analyser/checklists/requirements.md` (SC-003)

**Checkpoint**: US2 independently valuable for onboarding/debugging decisions.

---

## Phase 5: User Story 3 - Consume Results Iteratively with Progress Visibility (Priority: P3)

**Goal**: Show stage progress during analysis and keep results browsable across sections without reruns.

**Independent Test**: Run analysis and verify stage progression events + persistent section navigation after completion.

### Implementation for User Story 3

- [X] T028 [US3] Implement stage-notification emission (`gathering`, `architecture`, `deployment`, `flows`, `code`, `summary`) in `teams/team-d/src/features/project-analyser/project-analysis-service.ts`; keep `analysis-panel.ts` as subscriber/renderer only
- [X] T029 [US3] Implement progress bar/stage UI state transitions for IPC notifications in `teams/team-d/src/features/project-analyser/analysis-panel.ts`
- [X] T030 [US3] Ensure completed report state persists while switching tabs/sections in `teams/team-d/src/features/project-analyser/analysis-panel.ts`
- [X] T031 [US3] Implement robust retry flow after recoverable error responses in `teams/team-d/src/features/project-analyser/analysis-panel.ts`

### Validation for User Story 3

- [X] T032 [US3] Validate stage transition completeness and ordering across successful runs (SC-004)
- [X] T033 [US3] Validate retry success behavior for recoverable failures (SC-005)

**Checkpoint**: US3 independently improves usability and trust.

---

## Phase 6: Cross-Cutting Compliance, Quality, and Release Readiness

**Purpose**: Ensure architecture, security, and delivery governance requirements are met.

- [X] T034 [Shared] Run and fix spec governance validation: `node scripts/validate-spec.js`
- [X] T035 [Shared] Run monorepo build and fix regressions: `npm run build`
- [X] T036 [Shared] Run Team D package checks in `teams/team-d/`: `npm run build`, `npm run lint`, `npm run test`; fix failures before acceptance
- [X] T037 [Shared] Verify redaction behavior with seeded secret/token patterns and confirm no leaks in rendered report output (SC-008)
- [X] T038 [Shared] Perform architecture-conformance review to confirm no direct bypass of shared MCP/core tools (SC-009, SC-010)
- [X] T039 [Shared] Document missing reusable capabilities as global tooling gaps in `teams/team-d/specs/001-project-analyser/research.md` (SC-011)
- [X] T040 [Shared] Final acceptance walkthrough against `teams/team-d/specs/001-project-analyser/spec.md` and update `teams/team-d/specs/001-project-analyser/checklists/requirements.md`
- [X] T041 [Shared] Add focused unit tests for report assembly, redaction, confidence/limitations, and IPC contract handling in `teams/team-d/src/tests/project-analyser/project-analysis-service.test.ts` and `teams/team-d/src/tests/project-analyser/ipc-contract.test.ts`
- [X] T042 [Shared] Run standard-depth performance benchmark on at least 20 representative runs and verify >=85% complete within 120 seconds; record evidence in `teams/team-d/specs/001-project-analyser/checklists/requirements.md` (FR-014, SC-006)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 and blocks all user stories.
- **Phases 3–5 (User Stories)**: Depend on Phase 2 completion.
- **Phase 6 (Cross-Cutting)**: Depends on completion of desired user stories.

### User Story Dependencies

- **US1 (P1)**: Starts right after foundational phase; delivers MVP report flow.
- **US2 (P2)**: Depends on US1 base report assembly but remains independently testable as deeper insight quality.
- **US3 (P3)**: Depends on US1 panel/run flow and can proceed in parallel with late US2 polish.

### Parallel Opportunities

- T003 and T007 can run in parallel with other foundational tasks.
- Within US1, T011–T014 can run in parallel before T015 integration.
- Within US1, T015a and T015b run before T016 to ensure depth/scope semantics are wired end-to-end.
- Within US2, T021–T023 can run in parallel before UI integration task T024.
- In Phase 6, T034 and T035 can run in parallel, followed by focused fixes.

## Parallel Example: US1

```bash
# Parallel service section work
T011  # architecture extraction
T012  # deployment extraction
T013  # business-flow extraction
T014  # code-behavior extraction

# Then integrate and validate
T015
T016
T019
```
