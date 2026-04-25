# Feature Specification: Project Analyser

**Feature Branch**: `001-project-analyser`  
**Created**: 2026-04-25  
**Status**: Draft  
**Input**: User description: "Create a Team D project analysis feature that reads workspace context and produces a readable, detailed repository analysis including architecture, business flows, control flow, errors/conditions, deployment strategy, and Mermaid diagrams."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate End-to-End Project Report (Priority: P1)

A developer opens the Project Analyser feature in the IDE, runs analysis for the current workspace, and receives one organized report covering architecture, business flows, control flow, error handling patterns, use cases, and deployment strategy.

**Why this priority**: This is the core value of the feature. Without a complete report generation flow, the feature does not solve the user problem.

**Independent Test**: Can be fully tested by running analysis in a representative repository and confirming that all required report sections are produced in one run.

**Acceptance Scenarios**:

1. **Given** a workspace is open, **When** the user starts analysis, **Then** the system returns a report that includes architecture, business flows, code behavior insights, and deployment strategy.
2. **Given** a report is generated, **When** the user reviews it, **Then** each section is readable and organized with clear headings and structured summaries.
3. **Given** analysis completes successfully, **When** the report is displayed, **Then** the report includes at least one Mermaid diagram for architecture and at least one Mermaid diagram for business/control flow.
4. **Given** analysis requires workspace reads, diagnostics, or related tooling, **When** the feature executes analysis operations, **Then** it uses shared MCP/core common tools rather than direct ad-hoc runtime calls.

---

### User Story 2 - Understand Complex Flows and Edge Behaviors (Priority: P2)

A developer uses the report to understand branching logic, conditions, error-handling paths, and multiple use cases so they can reason about behavior before making changes.

**Why this priority**: This provides high leverage for onboarding, debugging, and safe refactoring after the primary reporting flow exists.

**Independent Test**: Can be tested by verifying the report identifies key conditions, common error paths, and at least two distinct use cases with outcomes.

**Acceptance Scenarios**:

1. **Given** a codebase with conditional logic and error handling, **When** the report is generated, **Then** the report identifies key conditions and notable error behaviors.
2. **Given** multiple business/use-case paths, **When** the user opens the report, **Then** the report presents the use cases as distinct, understandable flows.

---

### User Story 3 - Consume Results Iteratively with Progress Visibility (Priority: P3)

A developer wants progress visibility while analysis runs and then explores report sections (overview, architecture, flows, deployment, code insights) without re-running analysis.

**Why this priority**: Progress visibility and sectioned navigation improve trust and usability for longer analyses.

**Independent Test**: Can be tested by triggering analysis and confirming progress updates are shown, then navigating report sections without losing generated output.

**Acceptance Scenarios**:

1. **Given** analysis is running, **When** stages complete, **Then** the user sees stage-level progress updates.
2. **Given** analysis has finished, **When** the user switches report sections, **Then** report data remains available and readable without rerunning.

---

### Edge Cases

- Workspace is very large and cannot be fully analyzed in one pass: system should still return a partial but coherent report with explicit coverage notes.
- Workspace has missing/limited documentation: system should infer structure from available files and mark low-confidence areas.
- Repository includes generated/vendor artifacts: analysis should prioritize relevant project files and avoid noise-heavy conclusions.
- Mermaid text is malformed or cannot render in UI: raw diagram source should still be shown as fallback text.
- Analysis call fails or times out: user receives a clear error message and can retry without restarting the IDE session.
- Repository content includes secrets or credential-like strings: report output should redact sensitive values while preserving analysis usefulness.
- A required shared MCP/core tool is unavailable or disabled: system should fail gracefully with actionable guidance rather than silently switching to direct custom calls.
- A required capability is missing and clearly reusable across teams: system should flag it as a global shared-tool/common-core gap instead of implementing a Team D-only workaround.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to start repository analysis for the currently opened workspace from the Team D Project Analyser feature.
- **FR-002**: System MUST generate a structured report containing these sections: executive overview, architecture analysis, business flows, code behavior analysis, and deployment strategy.
- **FR-003**: System MUST include architecture representation and business/control flow representation using Mermaid-compatible diagram output.
- **FR-004**: System MUST identify and present key conditions, decision points, and notable error-handling behaviors found in analyzed project content.
- **FR-005**: System MUST identify and present multiple concrete use cases inferred from repository behavior.
- **FR-006**: System MUST provide progress updates by analysis stage while report generation is running.
- **FR-007**: System MUST present generated results in a readable, sectioned format that supports quick navigation across report areas.
- **FR-008**: System MUST support at least three analysis depths (shallow, standard, deep) that vary breadth of repository coverage.
- **FR-009**: System MUST handle incomplete or partially analyzable repositories by returning best-effort output and explicitly indicating limitations.
- **FR-010**: System MUST expose clear failure feedback and allow the user to retry analysis after recoverable errors.
- **FR-011**: Inter-process communication between UI and feature runtime MUST use a defined IPC standard message envelope with request/response correlation and structured error semantics.
- **FR-012**: The feature’s business logic for analysis orchestration MUST remain in Team D feature code, while shared infrastructure remains in core/adapter layers.
- **FR-013**: Default analysis scope MUST cover the full active workspace unless the user explicitly narrows scope.
- **FR-014**: Standard-depth analysis MUST target completion within 120 seconds for representative repositories under normal conditions.
- **FR-015**: Analysis output contract MUST be strict structured data that includes sectioned findings and Mermaid-compatible diagram fields.
- **FR-016**: Each major report section MUST include a confidence level and explicit limitations when certainty is reduced.
- **FR-017**: Generated report output MUST redact secrets, credentials, and token-like sensitive values.
- **FR-018**: Analysis data access and tool actions MUST be executed through registered MCP tools and shared core/common adapters where equivalent capability already exists.
- **FR-019**: The feature MUST NOT introduce parallel direct workspace/IDE access calls for capabilities already provided by MCP/core common tooling.
- **FR-020**: Tool usage paths MUST remain auditable through the shared tool abstraction layer so behavior is consistent across teams and IDE adapters.
- **FR-021**: If required functionality is missing from shared MCP/core/common tooling and has cross-team applicability, the feature MUST report it as a global tooling requirement (including rationale and expected contract) rather than implementing a local Team D-specific substitute.

### Key Entities *(include if feature involves data)*

- **Analysis Request**: User-initiated request context including depth selection and workspace scope.
- **Analysis Stage Update**: Progress event describing current stage, message, and completion percentage.
- **Project Report**: Aggregated artifact containing overview, architecture findings, business flows, code insights, deployment findings, and diagrams.
- **Flow Insight**: Structured representation of a business flow or control-flow path, including steps, conditions, and outcomes.
- **Use Case Insight**: Structured representation of inferred use case trigger, path, and outcomes.
- **Diagram Artifact**: Mermaid-compatible diagram source associated with architecture or flow sections.
- **Confidence Annotation**: Per-section confidence indicator and supporting limitation notes.
- **Tool Invocation Record**: Traceable operation metadata indicating which shared MCP/core tool was used for each analysis action.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a representative project, users can generate a complete report (all mandatory sections present) in a single run at standard depth.
- **SC-002**: At least 90% of analysis runs that finish successfully include renderable Mermaid output for architecture and for at least one flow section.
- **SC-003**: In usability validation, at least 85% of users can correctly answer architecture and flow comprehension questions from the generated report without reading source files first.
- **SC-004**: At least 90% of successful runs show stage progress updates from start through completion without missing stage transitions.
- **SC-005**: For recoverable failures, users can successfully retry and complete analysis in at least 80% of retry attempts.
- **SC-006**: In representative repositories, at least 85% of standard-depth runs complete within 120 seconds.
- **SC-007**: 100% of generated report sections include confidence and limitation annotations when uncertainty is present.
- **SC-008**: In validation checks with seeded sensitive strings, 100% of report outputs redact secret/token/credential values.
- **SC-009**: In architecture-conformance review, 100% of workspace-read and diagnostics operations in this feature are routed through shared MCP/core tool abstractions.
- **SC-010**: 0 approved code paths in this feature bypass existing shared MCP/core tooling for equivalent capabilities.
- **SC-011**: For missing reusable capabilities discovered during delivery, 100% are documented as global shared-tooling gaps and 0 are resolved through Team D-only workaround implementations.

## Assumptions

- Users run the feature with an open workspace containing sufficient source/config/documentation artifacts for meaningful inference.
- Deep analysis may take longer than shallow/standard analysis; users accept longer wait time for broader coverage.
- Report quality depends on repository clarity; low-documentation projects may yield lower-confidence insights.
- Team D feature code owns analysis orchestration and report shaping; shared core/adapter packages provide reusable contracts and infrastructure access.
- Shared MCP/core common tools required for repository analysis are available and kept as the default execution path.
- Mermaid rendering support is available in the analysis UI, with plain-text fallback if rendering fails.
- Full-workspace analysis is the default operating mode for this feature.
- Structured report output is the primary source for rendering and downstream processing.
- Missing cross-team capabilities are raised as shared/global follow-up work instead of being solved as local feature-only implementations.
