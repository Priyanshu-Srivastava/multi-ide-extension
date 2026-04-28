# Data Model: GitHub MCP Integration - PR Review Shared Infrastructure

**Feature**: `specs/001-pr-review-mcp-dependencies`  
**Date**: 2026-04-28  
**Owner**: controller-pod

## Entities

### 1. MCPToolRegistration

Represents one registered global GitHub MCP capability in the shared registry.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| toolId | string | yes | Global tool identifier in registry (e.g., `github.pull_request_read`) |
| displayName | string | yes | Human-readable name in diagnostics/UI |
| teamId | string | yes | Owning team, fixed to `controller-pod` |
| upstreamName | string | yes | Actual GitHub MCP tool name (e.g., `pull_request_read`) |
| enabled | boolean | yes | Runtime enablement flag from `mcp.config.json` |
| readOnly | boolean | yes | Whether transport enforces read-only mode |
| transportType | enum | yes | `http-remote` or `stdio-sidecar` |
| requiredScope | string | yes | GitHub permission scope (`repo`) |

Validation Rules:
- `toolId` must be unique in registry.
- `teamId` must equal `controller-pod` for this feature.
- If `readOnly = true`, write operations are prohibited for that registration.

---

### 2. TransportProfile

Defines how a host IDE reaches GitHub MCP.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| ide | enum | yes | `vscode`, `cursor`, `jetbrains` |
| transportType | enum | yes | `http` or `stdio` |
| endpoint | string | conditional | Remote URL for HTTP transport |
| command | string | conditional | Executable for stdio transport (`docker`) |
| args | string[] | conditional | Launch arguments for stdio process |
| headers | map<string,string> | optional | MCP headers (`X-MCP-Toolsets`, `X-MCP-Readonly`) |
| timeoutMs | number | yes | Per-call timeout (30_000) |
| authMode | enum | yes | `oauth`, `pat`, or `oauth+pat-fallback` |

Validation Rules:
- `vscode` and `cursor` require `transportType = http`.
- `jetbrains` requires `transportType = stdio`.
- `timeoutMs` must be >= 1000 and <= 60000.

---

### 3. SidecarSession

Represents the managed process lifecycle for JetBrains bridge.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| sessionId | string | yes | Runtime identifier for sidecar lifecycle |
| status | enum | yes | `starting`, `ready`, `failed`, `restarting`, `stopped` |
| processId | number | optional | OS process identifier when started |
| startedAt | string (ISO) | optional | Session start time |
| restartCount | number | yes | Number of restart attempts in session |
| lastError | string | optional | Last terminal/process error |

State Transitions:
- `starting -> ready`
- `starting -> failed`
- `ready -> restarting -> ready`
- `ready -> restarting -> failed`
- `ready -> stopped`

Constraints:
- One active session per JetBrains sidecar host.
- Maximum automatic restarts per failure event: 1.

---

### 4. MCPInvocationEnvelope

Canonical request/response envelope flowing through adapter -> registry -> transport.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| correlationId | string | yes | Correlates logs/metrics across all layers |
| method | string | yes | RPC method (`tools/call`) |
| params | object | optional | Tool name + arguments |
| startedAt | string (ISO) | yes | Invocation start timestamp |
| durationMs | number | yes | End-to-end latency |
| status | enum | yes | `success` or `failure` |
| result | unknown | optional | Returned data on success |
| error | string | optional | Human-readable error message |
| errorClass | enum | optional | `transient` or `permanent` |

Validation Rules:
- `correlationId` required for every invocation.
- `durationMs` must be non-negative.
- `status = failure` requires `error`.

---

### 5. PrReadProjection

Normalized read projection consumed by team features via `PrReviewReadPort`.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| repository | string | yes | `<owner>/<repo>` composite |
| pullNumber | number | yes | PR number |
| context | object | yes | PullRequestContext payload |
| changedFiles | array | yes | ChangedFile[] payload |
| reviewThreads | array | optional | Resolved/retrieved thread list |
| sourceTool | string | yes | Tool used (`pull_request_read`) |
| fetchedAt | string (ISO) | yes | Retrieval timestamp |

Constraints:
- Must be derivable solely from `pull_request_read` methods.
- Binary files may contain `patch = null`.

---

### 6. ReviewWriteCommand

Represents write flow input for submitting review comments.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| repository | string | yes | `<owner>/<repo>` |
| pullNumber | number | yes | PR number |
| draft | object | yes | ReviewCommentDraft payload |
| commitId | string | optional | Target commit SHA |
| event | enum | optional | `APPROVE`, `REQUEST_CHANGES`, `COMMENT` |
| submitMode | enum | yes | `pending-only`, `submit-immediately`, `submit-pending` |
| correlationId | string | yes | Cross-layer tracing identifier |

Lifecycle:
1. `create` review (pending)
2. `add_comment_to_pending_review`
3. `submit_pending` (optional based on mode)

Failure Rules:
- Invalid line/path keeps draft unresolved and returns failure.
- Missing pending review in submit path returns permanent failure.

---

## Relationships

- `MCPToolRegistration` 1..* -> 1 `TransportProfile` (each tool uses one transport profile per host).
- `TransportProfile` 1 -> 0..1 `SidecarSession` (only for JetBrains).
- `MCPInvocationEnvelope` references exactly one `MCPToolRegistration` and one `TransportProfile`.
- `PrReadProjection` is produced from one or more `MCPInvocationEnvelope` instances.
- `ReviewWriteCommand` executes through multiple `MCPInvocationEnvelope` instances in sequence.

## Derived Metrics Model

The following metrics are derived from `MCPInvocationEnvelope`:
- `mcp_calls_total{toolId, ide}`
- `mcp_calls_success_total{toolId, ide}`
- `mcp_calls_failure_total{toolId, ide, errorClass}`
- `mcp_latency_ms_p95{toolId, ide}`
- `mcp_timeout_total{toolId, ide}`
