# Research: Project Analyser

## Decision Log

- Decision: Keep Team D analysis orchestration in feature code and route repository access through `WorkspaceContextReaderPort` implemented by the shared `WorkspaceReader` MCP wrapper.
	Rationale: This preserves the Team D business-logic boundary while keeping workspace access auditable and adapter-neutral.

- Decision: Implement explicit depth profiles (`shallow`, `standard`, `deep`) with different sampling budgets and source inclusion rules.
	Rationale: The feature needs predictable performance and explainable coverage trade-offs instead of implicit file-discovery behavior.

- Decision: Add deterministic post-processing for control-flow patterns, error-handling patterns, key conditions, and default use cases when LLM output is sparse.
	Rationale: The report must remain readable and useful even when sampled context is incomplete or the model under-structures its response.

- Decision: Use Mermaid as the primary diagram contract but fall back to raw diagram text when rendering fails.
	Rationale: This keeps diagrams inspectable even if syntax is malformed or the webview renderer cannot render a specific graph.

- Decision: Keep JSON-RPC 2.0 envelopes between webview and extension runtime.
	Rationale: Request/response correlation and structured error semantics are required by the spec and make retry/progress behavior predictable.

- Decision: Redact token-like values and credential patterns after model generation instead of trusting prompt instructions alone.
	Rationale: Output safety must not depend solely on model compliance.

## Tooling Gap Findings

- Global tooling gap: Deployment Pipeline Extraction Tooling.
	Rationale: Deployment analysis still relies on script/doc inference. A shared tool that normalizes CI/CD configs and publish scripts into structured pipeline steps would benefit multiple teams.
	Expected contract: Shared MCP/core capability that reads CI config, package scripts, and deployment manifests, then emits ordered `build|test|package|publish|deploy` steps with targets.

- Global tooling gap: Structured Control-Flow Extraction Tooling.
	Rationale: Code-behavior analysis remains sample-based and heuristic. A reusable static-analysis capability would improve branch/use-case extraction across features.
	Expected contract: Shared MCP/core capability that emits control-flow nodes, branch conditions, error paths, and candidate use cases from sampled source.

## Validation Notes

- Team D feature-path review found no direct `@omni/adapters-vscode`, `vscode.workspace`, `vscode.commands`, or `registry.execute(...)` usage under `teams/team-d/src/features/project-analyser/`.
- Repository reads in the analyser service are executed through `readRelative`, `findFiles`, and `readMany` on `WorkspaceContextReaderPort`.
- Copilot tool passing exists in the shared adapter via `context.toolNames`, but the Project Analyser currently does not attach LM tools; repository access remains shared-reader based rather than direct LM tool invocation.
