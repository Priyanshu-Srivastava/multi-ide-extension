# Research: PR Review Visualizer and Analyzer

## Decision Log

### D-001: Traversal strategy is deterministic depth-first search

- Decision: Use deterministic DFS over file-flow graph with stable child ordering.
- Why: Matches the required recursive-first behavior and minimizes reviewer context switching.
- Consequence: Requires explicit visited tracking and deterministic sort keys.

### D-002: Entry-point selection is confidence-first with deterministic fallback

- Decision: Choose reviewer override when provided; else highest-confidence inferred node; if tied, lexical file-path order.
- Why: Balances intelligent defaults with predictability and reproducibility.
- Consequence: Entry-point evaluator must return confidence metadata and tie-break rationale.

### D-003: MCP capability remains global, not team-owned

- Decision: Use existing global MCP registry and shared port contracts only.
- Why: Constitution rule and architecture constraints require project-global tooling.
- Consequence: No MCP tool implementation files will be introduced under `teams/team-c/src`.

### D-004: Snapshot consistency model for review sessions

- Decision: A review session runs against one PR snapshot; if PR head changes, prompt user to refresh.
- Why: Prevents line-mapping drift and comment mis-targeting.
- Consequence: Session state stores source commit/snapshot metadata.

### D-005: Code/Test grouping is convention-based with explicit default

- Decision: Classify files as Tests based on repository patterns (test directories and naming suffixes), fallback to Code.
- Why: Provides predictable grouping without manual setup overhead.
- Consequence: Maintain centrally testable classification rules.

### D-006: Non-renderable changes are visible but not inline-diffed

- Decision: Binary/deleted-only/unsupported files are marked non-renderable with reason and retained in sequence summary.
- Why: Preserves completeness while preventing broken diff views.
- Consequence: Viewer requires a non-renderable state component and skip behavior.
