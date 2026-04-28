# Feature Specification: PR Review Visualizer and Analyzer

**Feature Branch**: `[001-pr-review-visualizer-analyzer]`  
**Created**: 2026-04-28  
**Status**: Draft  
**Input**: User description: "For team C I want to create an extension for PR review visualizer and analyser. Use GitHub MCP to get pull requests and file changes, analyze flow-linked file diffs, generate per-change insights, and allow reviewers to post line comments from the UI."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Flow-Based PR Traversal (Priority: P1)

As a reviewer, I can open a pull request and navigate changed files one at a time in application-flow order so I can understand behavioral impact before commenting.

**Why this priority**: Flow-aware navigation is the core value proposition and enables meaningful review decisions.

**Independent Test**: Can be fully tested by selecting a pull request with multiple changed files and validating that the first page starts at the detected entry-point file, then proceeds through connected files in depth-first order before backtracking.

**Acceptance Scenarios**:

1. **Given** a pull request with changed application files, **When** the reviewer opens visualization mode, **Then** the system shows one file at a time and starts from a computed entry-point file.
2. **Given** a node with multiple child nodes, **When** the reviewer clicks Next, **Then** the system follows the first recursive child path to completion before returning to siblings.
3. **Given** the reviewer has reached a leaf node, **When** the reviewer clicks Next, **Then** the system returns to the nearest unvisited ancestor branch and continues traversal.

---

### User Story 2 - Per-Change AI Analysis (Priority: P2)

As a reviewer, I can see before/after diffs with line-level color coding and AI commentary for each change hunk so I can quickly identify intent, risk, and downstream impact.

**Why this priority**: AI-assisted understanding reduces review time and increases defect detection quality.

**Independent Test**: Can be tested by opening any changed file page and verifying each displayed hunk includes summary, downstream impact note, code smell assessment, pattern/regression checks, and bug risk callouts.

**Acceptance Scenarios**:

1. **Given** a file page is opened, **When** diff content is rendered, **Then** removed lines are visibly marked in red and added lines in green with before/after context.
2. **Given** a change hunk is displayed, **When** analysis completes, **Then** the UI shows a concise explanation of why the change exists and what could break downstream.
3. **Given** no significant risk is found for a hunk, **When** analysis is presented, **Then** the system explicitly indicates low-risk status rather than leaving the section blank.

---

### User Story 3 - In-Context PR Commenting (Priority: P3)

As a reviewer, I can add line-level review comments directly from the visualized diff so feedback is sent back to the pull request without leaving the tool.

**Why this priority**: In-context commenting closes the loop from analysis to action and avoids context switching.

**Independent Test**: Can be tested by writing a comment on a selected changed line and confirming the comment appears on the corresponding pull request conversation thread.

**Acceptance Scenarios**:

1. **Given** a changed line is selected, **When** the reviewer submits a comment, **Then** the comment is posted to the correct file and line in the pull request.
2. **Given** comment submission fails, **When** the system receives an error from GitHub, **Then** the reviewer sees a clear error state and can retry without losing typed content.
3. **Given** a review includes multiple comments, **When** submission succeeds, **Then** each comment maps to its intended line and file path.

---

### User Story 4 - Test Files Separation (Priority: P4)

As a reviewer, I can switch between code files and test files in separate tabs so I can review behavior changes and test coverage independently.

**Why this priority**: Splitting production and test changes improves focus and makes coverage gaps easier to detect.

**Independent Test**: Can be tested by opening a pull request that includes both code and test changes and validating that each appears only in its corresponding tab.

**Acceptance Scenarios**:

1. **Given** a pull request contains test and non-test files, **When** the file graph is prepared, **Then** test-related files appear in the Tests tab and non-test files appear in the Code tab.
2. **Given** the reviewer switches tabs, **When** traversal resumes, **Then** navigation state is preserved independently per tab.

### Edge Cases

- Pull request includes only test files or only non-test files.
- Pull request contains renamed, deleted, or binary files that cannot be line-rendered.
- Entry-point inference yields multiple candidates with equal confidence.
- File graph contains cycles due to mutual dependencies.
- A file appears in both runtime and test contexts (for example, test utilities imported by app code).
- A pull request has too many changed files for immediate full analysis.
- GitHub MCP rate limits or temporary API failures interrupt retrieval or comment posting.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a reviewer to provide or select a repository pull request and retrieve pull request metadata and changed file list through GitHub MCP integration.
- **FR-002**: System MUST retrieve file-level diff hunks, including before/after line context and line numbers required for review rendering and comment mapping.
- **FR-003**: System MUST classify changed files into at least two groups: application code files and test files.
- **FR-004**: System MUST present file groups as separate tabs and maintain independent traversal context per tab.
- **FR-005**: System MUST build a directed file relationship graph from the repository codebase and changed files to represent likely application-flow connections.
- **FR-006**: System MUST determine and display an entry-point file for traversal based on graph and flow analysis rules.
- **FR-007**: System MUST traverse nodes in depth-first order, completing the first recursive child path before returning to sibling branches.
- **FR-008**: System MUST show exactly one file page at a time in the review viewer.
- **FR-009**: System MUST render each file page with pull-request-style before/after diff presentation and clear red/green line-level change indicators.
- **FR-010**: System MUST generate AI analysis per displayed change hunk including: change intent summary, downstream impact, code smell detection, pattern/standard deviation warnings, and bug/regression risk notes.
- **FR-011**: System MUST allow reviewer-authored line-level comments from the UI and post them to the corresponding pull request location using GitHub MCP.
- **FR-012**: System MUST preserve unsent comment drafts while the reviewer navigates between files.
- **FR-013**: System MUST show explicit success or failure feedback for each posted comment and provide retry capability on failure.
- **FR-014**: System MUST provide traceable mapping between displayed line selections and the pull request file path/line targeting used for posting comments.
- **FR-015**: System MUST support manual override for starting file selection when reviewer chooses not to use the suggested entry-point.
- **FR-016**: System MUST surface a readable explanation of the current graph position (current node, parent, and remaining branches) to orient the reviewer.
- **FR-017**: System MUST record review session activity sufficient to resume traversal position after an interruption within the same review session.

### Requirement Clarifications

- **RC-001 (GitHub MCP Data Retrieval Scope)**: Pull request loading includes pull request metadata, changed file inventory, and diff hunks needed for line-level rendering and comment targeting.
- **RC-002 (GitHub MCP Commenting Scope)**: Comment submission supports file-level and line-level review comments where the target line is present in the rendered diff.
- **RC-003 (Entry-Point Selection Order)**: Entry-point selection follows this order: explicit reviewer override first, otherwise highest confidence inferred candidate; if confidence ties, select lexicographically by file path for deterministic behavior.
- **RC-004 (Traversal Determinism)**: Child traversal order is deterministic and stable across reloads for the same pull request snapshot, so Next/Previous navigation does not reorder nodes unexpectedly.
- **RC-005 (Cycle Handling)**: Graph traversal uses visited-node tracking to prevent infinite loops; when a cycle is detected, traversal continues by backtracking to the nearest unvisited branch.
- **RC-006 (Code vs Test Classification Rule)**: Files are classified as Tests when they match repository test conventions (naming and folder patterns); unmatched files default to Code.
- **RC-007 (Tab Traversal State)**: Code and Tests tabs keep separate traversal state (current node, visited nodes, and backtrack stack), and tab switching does not reset either state.
- **RC-008 (Non-Renderable Changes)**: Deleted-only, binary, or unsupported files are listed with a non-renderable label and rationale, but remain visible in the review sequence summary.
- **RC-009 (AI Analysis Completeness)**: Each visible diff hunk includes all required analysis fields: intent summary, downstream impact, quality risks, and explicit low-risk statement when no issue is detected.
- **RC-010 (AI Analysis Traceability)**: Analysis is anchored to hunk identity so users can trace each insight to the exact changed lines being reviewed.
- **RC-011 (Comment Draft Persistence)**: Draft comments persist while navigating between nodes in the same session until submitted or manually discarded.
- **RC-012 (Submission Failure Behavior)**: Failed comment submissions preserve draft content, show actionable error feedback, and allow retry without reselecting the target line.
- **RC-013 (Review Snapshot Consistency)**: Traversal and analysis operate against a single pull request snapshot per session; if new commits are detected, the user is notified and can refresh to a new snapshot.
- **RC-014 (Multi-Comment Mapping Integrity)**: When multiple comments are submitted in one review session, each comment keeps a unique mapping to its file path and line target to prevent cross-linking.
- **RC-015 (Global Tooling Location)**: MCP tools and tool contracts used by this feature are project-global shared assets and MUST be implemented in shared packages, not in team-scoped feature folders.
- **RC-016 (Companion Global Dependency Spec)**: Shared MCP dependency work for this feature is tracked in the companion global spec at `specs/001-pr-review-mcp-dependencies/spec.md`, and team-c scope excludes direct MCP tool implementation ownership.

### Architecture Constraints (Hexagonal)

- **AC-001 (Domain Isolation)**: Core review-analysis rules, traversal logic, and comment-target mapping rules MUST be defined independent of delivery channels and external services.
- **AC-002 (Port-Based Integration)**: All interactions with external systems (including GitHub MCP) MUST be expressed through explicit inbound or outbound ports with clear behavioral contracts.
- **AC-003 (Adapter Responsibility)**: UI rendering, GitHub MCP communication, and persistence/session concerns MUST be implemented as adapters that depend on ports rather than embedding domain decisions.
- **AC-004 (Dependency Direction)**: Dependency flow MUST point inward toward domain rules; domain rules MUST NOT depend on adapter-specific concerns.
- **AC-005 (Replaceability)**: External provider adapters (for pull request retrieval and comment posting) MUST be replaceable without requiring domain-rule changes.
- **AC-006 (Testability by Layer)**: Domain behavior MUST be testable without live external integrations; adapter behavior MUST be testable against port contracts.
- **AC-007 (No Team-Specific Tool Implementations)**: New MCP tool implementations, registries, and tool contracts MUST be added under global package paths and consumed by teams; `teams/<team>/src` may orchestrate feature behavior but MUST NOT define team-private MCP tools.

### Key Entities *(include if feature involves data)*

- **Pull Request Context**: Repository identifier, pull request number, title, author, branch references, and status metadata.
- **Changed File**: File path, classification (code or test), diff hunks, and graph-node relationships.
- **Diff Hunk**: A contiguous change segment with before/after lines, line numbers, and visual markers for additions/deletions.
- **Flow Node**: Graph node representing a changed file with parent-child relationships and traversal order metadata.
- **Traversal State**: Current node, visited set, backtracking stack, active tab, and remaining branch queue.
- **AI Analysis Note**: Structured per-hunk insight including intent, downstream effects, quality risks, and confidence indicators.
- **Review Comment Draft**: User-authored comment text bound to file path and target line prior to submission.
- **Posted Review Comment**: Confirmed comment record with pull request mapping details and submission status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of pull requests with up to 100 changed text files are fully loaded and ready for first-file review within 30 seconds.
- **SC-002**: At least 90% of reviewers can correctly identify and follow the intended file traversal sequence without external guidance in usability testing.
- **SC-003**: At least 85% of displayed change hunks receive non-empty AI summaries rated as "useful" or better by reviewers in post-review feedback.
- **SC-004**: 99% of successful comment submissions appear on the correct pull request file and line target on first attempt.
- **SC-005**: Reviewers complete first-pass analysis of a 20-file pull request at least 30% faster than baseline manual review in pilot comparisons.
- **SC-006**: Less than 2% of review sessions terminate without recoverable state when interruptions occur.

## Assumptions

- Reviewers have permission to read pull request data and post review comments for target repositories.
- GitHub MCP is available and configured with scopes needed for pull request retrieval and comment submission.
- Initial version targets pull-request workflows in GitHub repositories and does not include non-GitHub providers.
- Entry-point detection uses repository structure and dependency signals, with reviewer override available when inference is imperfect.
- Binary or unsupported file types are excluded from line-by-line analysis and shown as non-renderable items.
- First release optimizes for pull requests up to 100 changed text files; larger pull requests may require staged analysis.

## Dependency Ownership

- **Team-C Feature Scope**: Reviewer workflow behavior, traversal UX, analysis presentation, and team orchestration logic.
- **Global MCP Scope**: Shared MCP contracts, registry/config capability wiring, and any MCP tool creation/modification required by this feature.
- **Companion Global Spec**: `specs/001-pr-review-mcp-dependencies/spec.md`
- **Implementation Note**: Team-C implementation consumes the approved companion global MCP dependency artifacts and does not introduce team-private MCP tools under `teams/team-c/src`.
