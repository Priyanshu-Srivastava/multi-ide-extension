# Feature Specification: GitHub MCP Integration — PR Review Shared Infrastructure

**Feature Branch**: `001-pr-review-mcp-dependencies`  
**Created**: 2026-04-28  
**Status**: Draft  
**Scope**: Global (controller-pod delivery)  
**Primary Consumer**: `teams/team-c/specs/001-pr-review-visualizer-analyzer`  
**Cross-Reference**: See [team-c spec](../../teams/team-c/specs/001-pr-review-visualizer-analyzer/spec.md) for team-level user stories.

---

## Summary

The controller-pod team owns and delivers the shared GitHub MCP integration infrastructure that enables all team-level PR review features to retrieve pull request data and submit review comments via the GitHub MCP server. This specification covers the full delivery scope: tool contracts, per-IDE transport wiring, authentication strategy, error handling, and the registry configuration required to connect three IDE environments (VS Code, Cursor, JetBrains) to the official GitHub MCP server.

No team may implement MCP tool adapters for GitHub under `teams/*/src`. All GitHub MCP connectivity is provided exclusively through `packages/mcp/` and `packages/core/src/ports/`.

---

## Clarifications

### Session 2026-04-28

- Q: What observability level is required for shared GitHub MCP infrastructure? → A: Logs + metrics + basic tracing (request correlation IDs across adapter, registry, sidecar).

---

## User Scenarios & Testing

### User Story 1 — PR Data Available in All Three IDEs (Priority: P1)

As a developer using any of the three supported IDEs (VS Code, Cursor, JetBrains), I can open the PR Review panel and have it display accurate pull request metadata, changed file list, and diff hunks — retrieved live from GitHub via the shared MCP infrastructure — without any per-team tool configuration.

**Why this priority**: Without GitHub data connectivity, the PR review feature delivers no value. This is the foundation that all team-level features depend on.

**Independent Test**: A team-c integration test can call `PrReviewReadPort.fetchPullRequestContext("owner/repo", 42)` against a running registry and receive a populated `PullRequestContext` response from GitHub — regardless of which IDE host is active.

**Acceptance Scenarios**:

1. **Given** VS Code (1.101+) is the active IDE and the user has authenticated via OAuth, **When** the PR review panel calls `fetchPullRequestContext`, **Then** a `PullRequestContext` object is returned containing PR title, state, head ref, base ref, author, and body within 3 seconds.
2. **Given** Cursor is the active IDE and OAuth is available, **When** `fetchPullRequestContext` is called, **Then** the same `PullRequestContext` structure is returned, identical to VS Code behaviour.
3. **Given** JetBrains is the active IDE with a valid GitHub PAT configured, **When** `fetchPullRequestContext` is called through the sidecar bridge, **Then** `PullRequestContext` is returned within 5 seconds (accounting for sidecar startup latency).
4. **Given** the GitHub MCP server is temporarily unavailable, **When** any fetch call is made, **Then** the system returns a structured error (`MCPToolResult.success = false`) with a user-readable message and does not crash the IDE panel.

---

### User Story 2 — Changed Files and Diffs Retrievable (Priority: P1)

As a developer reviewing a pull request, I can view the list of changed files and inspect unified diff content for each file — sourced from GitHub via the shared MCP integration.

**Why this priority**: Co-priority with US1. File and diff data are mandatory inputs for the AI analysis and visualisation layers in team-level features.

**Independent Test**: Calling `PrReviewReadPort.fetchChangedFiles("owner/repo", 42)` returns a non-empty `ChangedFile[]` array with filename, status, and patch data.

**Acceptance Scenarios**:

1. **Given** a PR with 5 changed files, **When** `fetchChangedFiles` is called, **Then** all 5 files are returned with `filename`, `status` (added/modified/deleted), `additions`, `deletions`, and raw `patch` content.
2. **Given** a large PR with more than 30 changed files, **When** `fetchChangedFiles` is called with default pagination, **Then** the first page (up to 30 files) is returned and a pagination cursor is available to retrieve subsequent pages.
3. **Given** a PR where a binary file has changed, **When** `fetchChangedFiles` is called, **Then** the binary file appears in the list with `patch` set to null and the response does not error.

---

### User Story 3 — Review Comments Can Be Submitted (Priority: P2)

As a developer, I can submit a line-level review comment on a specific file and line in a pull request from within the IDE — routed through the shared MCP write infrastructure.

**Why this priority**: Review write capability enables the interactive review workflow. It is lower priority than read because read-only PR visualisation is already valuable.

**Independent Test**: Calling `PrReviewWritePort.submitLineComment("owner/repo", 42, draft)` creates a pending review on GitHub with the specified comment and returns a `PostedReviewComment` with a non-empty `id`.

**Acceptance Scenarios**:

1. **Given** a developer has selected line 15 of `src/foo.ts` in the diff, **When** they submit a comment "Consider extracting this method", **Then** a pending review is created on GitHub with the comment attached to that line, and a `PostedReviewComment` is returned.
2. **Given** a pending review already exists for the current user, **When** an additional line comment is submitted, **Then** the comment is appended to the existing pending review rather than creating a new review.
3. **Given** the comment targets a line number that does not exist in the PR diff, **When** submission is attempted, **Then** the system returns `MCPToolResult.success = false` with a clear error describing the invalid line target — no GitHub API call succeeds partially.
4. **Given** read-only mode is enforced at the transport layer, **When** a write operation is attempted, **Then** the system rejects the request before reaching GitHub and returns a clear error to the caller.

---

### User Story 4 — Review Threads Viewable and Resolvable (Priority: P2)

As a reviewer or PR author, I can view all existing review threads on a PR, see their resolved/unresolved status, and resolve or unresolve individual threads from within the IDE.

**Why this priority**: Completing the review workflow loop requires the ability to manage thread state. This is a secondary capability built on top of the read infrastructure.

**Independent Test**: `fetchPullRequestContext` returns existing review threads. Calling the review write port with `resolve_thread` changes thread state on GitHub.

**Acceptance Scenarios**:

1. **Given** a PR with 3 review threads (2 resolved, 1 open), **When** review threads are fetched, **Then** all 3 threads are returned with correct `isResolved` and `isOutdated` flags, author logins, comment bodies, and file path/line references.
2. **Given** an unresolved thread with a known thread node ID, **When** the resolve action is triggered, **Then** the thread is marked resolved on GitHub and the local state reflects the update.

---

### User Story 5 — JetBrains Sidecar Bridge Implemented (Priority: P3)

As the controller-pod team, I deliver a production-ready `JetBrainsSidecarBridge` implementation (replacing the current stub) so that JetBrains-based developers have functional GitHub MCP connectivity.

**Why this priority**: JetBrains IDE cannot use VS Code extension APIs directly. The sidecar HTTP bridge is the only supported connectivity pattern. Without it, JetBrains users have no GitHub MCP access.

**Independent Test**: Start the JetBrains sidecar HTTP server; send a `POST /rpc` request with a valid `SidecarRequest` targeting `tools/call` for `pull_request_read`; receive a `SidecarResponse` with GitHub PR data.

**Acceptance Scenarios**:

1. **Given** the sidecar HTTP server is running on port 7654, **When** a `POST /rpc` request arrives with `{ method: "tools/call", params: { name: "pull_request_read", arguments: { method: "get", owner: "x", repo: "y", pullNumber: 1 } } }`, **Then** the bridge forwards the call to the local GitHub MCP server process and returns the response in `SidecarResponse` format.
2. **Given** the local GitHub MCP server process has not started yet, **When** the first RPC call arrives, **Then** the bridge spawns the process, caches it, and completes the call within 10 seconds.
3. **Given** the GitHub PAT is expired or missing, **When** a call is forwarded, **Then** the bridge returns `{ acknowledged: false, error: "GitHub authentication failed: token invalid or missing" }`.

---

### Edge Cases

- What happens when GitHub API rate limit is hit (HTTP 429/403)? → Tool returns `success: false` with rate-limit error; caller must surface wait-and-retry guidance to the user.
- What happens when a PR is deleted or the repository is private and the token lacks access? → GitHub MCP server returns an access-denied error; the registry propagates `MCPToolResult.success = false` with a descriptive message.
- What happens when OAuth token expires mid-session in VS Code? → VS Code re-triggers OAuth scope challenge; the MCP session reconnects transparently (OAuth flow owned by VS Code host, not the extension).
- What happens when the JetBrains sidecar port 7654 is already in use? → Server startup fails with a port-conflict error logged; fallback to configurable `OMNI_SIDECAR_PORT` environment variable.
- What happens when a GitHub MCP tool name is misspelled in `mcp.config.json`? → Registry startup logs a warning; tool remains disabled; no crash.
- What happens when pagination returns an empty page for changed files? → Returns empty array; caller handles gracefully without treating empty as an error.

---

## Requirements

### Functional Requirements

#### GitHub MCP Tool Registration

- **FR-001**: The MCP registry (`packages/mcp/`) MUST register the following GitHub MCP tools by default for the PR review feature set: `pull_request_read`, `pull_request_review_write`, `add_comment_to_pending_review`, `list_pull_requests`.
- **FR-002**: Tools MUST be registered under the `pull_requests` toolset configuration using the GitHub MCP server's official toolset name.
- **FR-003**: `mcp.config.json` MUST declare entries for all four registered tools with `enabled: true` for the PR review feature set and `teamId: "controller-pod"`.
- **FR-004**: Registry initialisation MUST NOT allow team-scoped (`teams/*/src`) tool implementations to register GitHub MCP tools. All GitHub tool adapters MUST reside in `packages/mcp/`.

#### Port Contracts

- **FR-005**: `packages/core/src/ports/pr-review-ports.ts` MUST expose `PrReviewReadPort` with methods: `fetchPullRequestContext(repository, prNumber)`, `fetchChangedFiles(repository, prNumber)`, and `fetchFlowNodes(repository, changedFilePaths)`.
- **FR-006**: `packages/core/src/ports/pr-review-ports.ts` MUST expose `PrReviewWritePort` with method: `submitLineComment(repository, prNumber, draft)` returning `PostedReviewComment`.
- **FR-007**: All domain calls to GitHub data MUST go through these ports. No adapter or team package may import `@octokit/*` or call GitHub REST/GraphQL APIs directly.
- **FR-008**: Port method signatures MUST NOT change without a major version bump in `packages/core`.

#### VS Code and Cursor Transport

- **FR-009**: VS Code adapter (`packages/adapters/vscode/`) MUST configure `ExternalMCPToolAdapter` with an HTTP transport connecting to `https://api.githubcopilot.com/mcp/` using VS Code's built-in OAuth (VS Code 1.101+).
- **FR-010**: The HTTP transport MUST include headers `X-MCP-Toolsets: pull_requests,context` and `X-MCP-Readonly: true` for read-only operations; write operations MUST omit `X-MCP-Readonly`.
- **FR-011**: When VS Code OAuth is unavailable (pre-1.101 or token not granted), the adapter MUST fall back to reading `GITHUB_PERSONAL_ACCESS_TOKEN` from the process environment. If neither is available, tool registration is skipped and the panel renders a "GitHub connection required" message.
- **FR-012**: Cursor adapter (`packages/adapters/cursor/`) inherits VS Code adapter behaviour and MUST NOT require separate transport implementation, as Cursor is VS Code API-compatible.

#### JetBrains Transport

- **FR-013**: JetBrains adapter (`packages/adapters/jetbrains/`) MUST implement a production `JetBrainsSidecarBridge` replacing the current stub. The bridge MUST connect to a locally spawned GitHub MCP server process via stdio.
- **FR-014**: The GitHub MCP server process for JetBrains MUST be started via Docker: `docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN ghcr.io/github/github-mcp-server`. The image version MUST be pinned (minimum v1.0.3).
- **FR-015**: `JetBrainsSidecarBridge` MUST implement `SidecarTransport`: `(request: SidecarRequest) => Promise<SidecarResponse>`. It MUST translate `SidecarRequest` into a JSON-RPC 2.0 `tools/call` request, write it to the child process stdin, and parse the response from stdout.
- **FR-016**: The bridge MUST manage a single persistent child process per sidecar session. It MUST NOT spawn a new Docker container per RPC call.
- **FR-017**: The bridge MUST implement a timeout of 30 seconds per individual RPC call. On timeout, it MUST return `{ acknowledged: false, error: "GitHub MCP call timed out after 30s" }`.
- **FR-018**: When the child process exits unexpectedly, the bridge MUST attempt one automatic restart before returning a persistent failure error.

#### Authentication

- **FR-019**: VS Code and Cursor MUST support GitHub OAuth (VS Code 1.101+ `vscode.authentication.getSession`) as the primary authentication method with scope `repo`.
- **FR-020**: All three IDEs MUST support `GITHUB_PERSONAL_ACCESS_TOKEN` as a PAT fallback. The token MUST have at minimum `repo` scope.
- **FR-021**: Authentication credentials MUST NOT be stored in `mcp.config.json` or any committed file. VS Code extension settings MUST use secure storage or OAuth sessions. JetBrains MUST read the PAT from the environment variable only.
- **FR-022**: When authentication is missing in JetBrains, the sidecar HTTP server MUST return HTTP 401 on `POST /rpc` with a structured error body, not a raw process crash.

#### Error Handling

- **FR-023**: All GitHub API errors (network failure, rate limit, 4xx/5xx) MUST be converted to `MCPToolResult { success: false, error: "<human-readable description>" }`. Raw GitHub API error objects MUST NOT propagate to callers of ports.
- **FR-024**: Rate-limit errors (HTTP 429 or `X-RateLimit-Remaining: 0`) MUST include a `retryAfter` field in the error data indicating seconds until reset.
- **FR-025**: The system MUST distinguish between transient errors (network timeout, 5xx) and permanent errors (401 auth failure, 404 not found) in `MCPToolResult.error` so callers can implement appropriate retry vs. abandon strategies.

#### Observability

- **FR-030**: The shared GitHub MCP layer MUST emit structured logs for every tool invocation with fields: `toolId`, `ide`, `operation`, `status`, `durationMs`, `errorCode` (when present), and `correlationId`.
- **FR-031**: The shared GitHub MCP layer MUST publish metrics per tool and IDE: call count, success count, failure count, p95 latency, and timeout count.
- **FR-032**: Every request path (adapter → registry → sidecar/external transport) MUST propagate a `correlationId` so logs from all three components can be joined for troubleshooting.

#### Architecture Guardrails

- **FR-026**: Domain logic in `packages/core/src/domain/` MUST depend only on `packages/core/src/ports/` interfaces. It MUST NOT import from `packages/adapters/`, `packages/mcp/`, or any `teams/` package.
- **FR-027**: `ExternalMCPToolAdapter` in `packages/mcp/` is the sole GitHub MCP adapter. It MUST implement `MCPToolPort` and MUST NOT expose any GitHub-specific types to its callers.
- **FR-028**: MCP tool contracts (port interfaces, request/response types) MUST reside in `packages/core/src/ports/` and `packages/core/src/types/`. They MUST NOT be duplicated in team packages.
- **FR-029**: The global dependency marker file `sceps.mc` MUST remain in `specs/001-pr-review-mcp-dependencies/` at all times as evidence of global scope.

### Key Entities

- **PullRequestContext**: Represents full PR metadata — number, title, state (open/closed/merged), head branch, base branch, author login, body, URL, head SHA, labels, milestone.
- **ChangedFile**: Represents a single file change — filename, status (added/modified/deleted/renamed), additions count, deletions count, changes count, patch (unified diff string, nullable for binary files), previous filename (for renames).
- **ReviewCommentDraft**: Represents a pending review comment to submit — path, body, line number, side (LEFT/RIGHT), start line (for multi-line), start side, subject type (FILE/LINE).
- **PostedReviewComment**: Confirmed review comment returned after submission — id, url, body, path, line, author login, created timestamp, review ID.
- **ReviewThread**: A grouped set of review comments on the same code location — thread node ID (`PRRT_kwDO...`), isResolved, isOutdated, isCollapsed, file path, line, array of `ReviewThreadComment`.
- **SidecarRequest / SidecarResponse**: JSON-RPC 2.0 envelope types defined in `packages/core/src/rpc/`. `SidecarRequest` carries `method` and `params`; `SidecarResponse` carries `result` or `error`.
- **MCPToolResult**: The universal return type of `MCPToolPort.execute()` — `{ success: boolean, data?: unknown, error?: string }`.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: All three IDEs can fetch live PR data from a real GitHub repository within 5 seconds of panel open (measured end-to-end from UI trigger to populated panel, excluding first-time Docker pull for JetBrains).
- **SC-002**: Zero GitHub MCP tool implementation files exist under `teams/*/src` after controller-pod delivery is complete; validated by CI path-lint rule.
- **SC-003**: `packages/core` port interfaces remain backward-compatible (no breaking changes) across at least 2 team feature consumer integrations without requiring team-side changes.
- **SC-004**: 100% of GitHub API error categories (auth failure, rate limit, not found, network timeout) produce structured `MCPToolResult` error responses — verified by unit tests covering each category.
- **SC-005**: JetBrains sidecar bridge handles 10 concurrent RPC calls without process contention or dropped responses in integration tests.
- **SC-006**: Review comment submission (line comment → pending review → submit) completes the full round-trip to GitHub and reflects the new comment in a subsequent `get_review_comments` call, validated in end-to-end tests.
- **SC-007**: Authentication setup for each IDE can be completed by a developer unfamiliar with the codebase in under 10 minutes, following only the documentation produced by this feature.
- **SC-008**: For at least 95% of tool calls in integration tests, `correlationId` appears in logs emitted by the adapter, registry, and sidecar/transport layers.

---

## GitHub MCP Tool Reference

This section documents the exact GitHub MCP server tool contracts used by this integration, derived from `github/github-mcp-server` v1.0.3 source.

### Tool: `pull_request_read`

**Toolset**: `pull_requests` | **Read-only**: yes | **Required scope**: `repo`

**Parameters** (all required unless marked optional):

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `method` | `enum` | Action: `get`, `get_diff`, `get_status`, `get_files`, `get_review_comments`, `get_reviews`, `get_comments`, `get_check_runs` |
| `owner` | `string` | Repository owner (user or org) |
| `repo` | `string` | Repository name |
| `pullNumber` | `number` | Pull request number |
| `perPage` | `number` (optional) | Page size for paginated methods |
| `page` | `number` (optional) | Page number for paginated methods |
| `after` | `string` (optional) | Cursor for cursor-based pagination (`get_review_comments`) |

**Method behaviours**:

| Method | Returns | Notes |
| ------ | ------- | ----- |
| `get` | `MinimalPullRequest` JSON | Title, state, headRef, baseRef, author, body, URL, head SHA |
| `get_diff` | Raw unified diff string | Plain text, not JSON |
| `get_status` | Combined commit status JSON | CI status for head SHA |
| `get_files` | `MinimalPRFile[]` JSON | filename, status, additions, deletions, changes, patch |
| `get_review_comments` | Review thread nodes JSON | Cursor-paginated; includes isResolved, isOutdated per thread |
| `get_reviews` | `MinimalPullRequestReview[]` JSON | Review state, author, body |
| `get_comments` | Issue-style comments JSON | General (non-review) PR comments |
| `get_check_runs` | `MinimalCheckRunsResult` JSON | totalCount + check run array |

**MCP response envelope**:
```json
{
	"content": [{ "type": "text", "text": "<serialised JSON or plain text>" }],
	"isError": false
}
```
When an error occurs: `isError: true`, `content[0].text` contains the error message.

---

### Tool: `pull_request_review_write`

**Toolset**: `pull_requests` | **Read-only**: no | **Required scope**: `repo`

**Parameters**:

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `method` | `enum` | yes | `create`, `submit_pending`, `delete_pending`, `resolve_thread`, `unresolve_thread` |
| `owner` | `string` | yes | Repository owner |
| `repo` | `string` | yes | Repository name |
| `pullNumber` | `number` | yes | Pull request number |
| `body` | `string` | optional | Review comment text (used by `create` and `submit_pending`) |
| `event` | `enum` | optional | `APPROVE`, `REQUEST_CHANGES`, `COMMENT` (omit to create pending review) |
| `commitID` | `string` | optional | SHA of commit to review |
| `threadId` | `string` | optional | Node ID (`PRRT_kwDO...`) — required for `resolve_thread` / `unresolve_thread` |

**Method behaviours**:

| Method | GitHub operation | Returns |
| ------ | ---------------- | ------- |
| `create` | Creates a new review; if `event` provided, submits immediately | `"pull request review submitted successfully"` or `"pending pull request created"` |
| `submit_pending` | Submits the viewer's existing pending review | `"pending pull request review successfully submitted"` |
| `delete_pending` | Deletes the viewer's existing pending review | `"pending pull request review successfully deleted"` |
| `resolve_thread` | Resolves the review thread with given `threadId` | `"review thread resolved successfully"` |
| `unresolve_thread` | Unresolves the review thread with given `threadId` | `"review thread unresolved successfully"` |

---

### Tool: `add_comment_to_pending_review`

**Toolset**: `pull_requests` | **Read-only**: no | **Required scope**: `repo`

Adds a single line or file comment to the viewer's active pending review. A pending review must already exist (created via `pull_request_review_write` with method `create` and no `event`).

**Parameters**:

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `owner` | `string` | yes | Repository owner |
| `repo` | `string` | yes | Repository name |
| `pullNumber` | `number` | yes | Pull request number |
| `path` | `string` | yes | Relative file path within the repository |
| `body` | `string` | yes | Comment text |
| `subjectType` | `enum` | yes | `FILE` or `LINE` |
| `line` | `number` | optional | Line number in diff (last line for multi-line comments) |
| `side` | `enum` | optional | `LEFT` (previous state) or `RIGHT` (new state) |
| `startLine` | `number` | optional | First line for multi-line comments |
| `startSide` | `enum` | optional | `LEFT` or `RIGHT` for multi-line start |

**Returns**: `"pull request review comment successfully added to pending review"` on success; `isError: true` with description on failure (invalid line, wrong path, etc.).

---

### Tool: `list_pull_requests`

**Toolset**: `pull_requests` | **Read-only**: yes | **Required scope**: `repo`

**Parameters**: `owner` (required), `repo` (required), `state` (open/closed/all), `head`, `base`, `sort` (created/updated/popularity/long-running), `direction` (asc/desc), `perPage`, `page`.

**Returns**: `MinimalPullRequest[]` JSON array.

---

## Per-IDE Integration Architecture

### VS Code (1.101+) and Cursor

**Transport type**: HTTP remote  
**Server URL**: `https://api.githubcopilot.com/mcp/`  
**Authentication**: VS Code OAuth session (`vscode.authentication.getSession("github", ["repo"])`) with PAT fallback

**MCP server configuration** (`.vscode/mcp.json` or extension-programmatic):
```json
{
	"servers": {
		"github-pr-review": {
			"type": "http",
			"url": "https://api.githubcopilot.com/mcp/",
			"headers": {
				"X-MCP-Toolsets": "pull_requests,context",
				"X-MCP-Readonly": "true"
			}
		}
	}
}
```
For write operations, `X-MCP-Readonly` header must be omitted or set to `false`.

**Adapter wiring** (`packages/adapters/vscode/src/activate.ts`):
- At activation, acquire OAuth token (or PAT from env).
- Construct an `HttpSidecarTransport` function: wraps `fetch("https://api.githubcopilot.com/mcp/", { method: "POST", headers: { Authorization: "Bearer <token>", "X-MCP-Toolsets": "pull_requests,context" }, body: JSON.stringify(rpcRequest) })`.
- Register `new ExternalMCPToolAdapter({ toolId: "github.pull_request_read", displayName: "GitHub PR Read", teamId: "controller-pod", transport: httpTransport })` in the registry.
- Repeat for `pull_request_review_write` and `add_comment_to_pending_review` (with write transport, no `X-MCP-Readonly`).

**Cursor**: Identical to VS Code. No separate implementation required.

---

### JetBrains

**Transport type**: stdio (local Docker container)  
**Docker image**: `ghcr.io/github/github-mcp-server` (pinned ≥ v1.0.3)  
**Authentication**: `GITHUB_PERSONAL_ACCESS_TOKEN` environment variable (PAT, `repo` scope)  
**Bridge location**: `packages/adapters/jetbrains/src/index.ts` → `JetBrainsSidecarBridge`

**Docker invocation** (spawned by bridge at first RPC call):
```
docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN \
	ghcr.io/github/github-mcp-server:v1.0.3 \
	--toolsets=pull_requests,context
```

**Bridge behaviour**:
1. On first `SidecarRequest`, spawn the Docker container as a child process with stdin/stdout pipes.
2. Write JSON-RPC 2.0 `initialize` handshake to stdin; await `initialized` notification.
3. For each subsequent request, write `{ jsonrpc: "2.0", id: <auto-increment>, method: "tools/call", params: { name: "<toolId>", arguments: <params> } }` to stdin.
4. Read response line from stdout; parse JSON; return as `SidecarResponse`.
5. Maintain a single persistent process — reuse across all calls in the session.
6. On process exit or timeout (30s per call), attempt one restart; if restart fails, return error response.

**Sidecar HTTP server** (`packages/adapters/jetbrains/src/activate.ts`):
- Routes `POST /rpc` → `JetBrainsSidecarBridge(body)` → returns `SidecarResponse` as JSON.
- Routes `GET /health` → returns tool list from registry.
- Listens on `OMNI_SIDECAR_PORT` (default 7654).

---

## Assumptions

- GitHub MCP server v1.0.3+ API surface is stable; the `pull_request_read`, `pull_request_review_write`, and `add_comment_to_pending_review` tool names and parameter schemas do not change without a new major version tag.
- VS Code OAuth for GitHub (scope `repo`) is available in VS Code 1.101+. Teams using older VS Code versions must use PAT fallback.
- Docker Desktop or Docker Engine is available on JetBrains developer machines. Without Docker, JetBrains integration is non-functional; this is documented as a prerequisite, not a defect.
- The `GITHUB_PERSONAL_ACCESS_TOKEN` environment variable is the sole credential injection mechanism for JetBrains. Credential management (secure storage, secrets manager) is outside scope of this feature.
- Cursor is VS Code API-compatible and inherits VS Code adapter behaviour without a separate implementation.
- `packages/core/src/ports/pr-review-ports.ts` already defines `PrReviewReadPort` and `PrReviewWritePort`. This feature completes the adapter implementation behind those ports, not the port interface itself (which is already shipped).
- GitHub PAT tokens of type fine-grained (`github_pat_` prefix) are supported for classic scopes; classic PATs (`ghp_` prefix) may have tool-level scope filtering applied by the GitHub MCP server at startup.
- The `mcp.config.json` schema supports `teamId` as a non-standard annotation field; it is used for ownership tracking only and does not affect runtime behaviour.

---

## Dependencies

- `github/github-mcp-server` ≥ v1.0.3 (public Docker image `ghcr.io/github/github-mcp-server`)
- VS Code ≥ 1.101 for OAuth; ≥ 1.96 for basic MCP HTTP support
- Docker Engine ≥ 20 (JetBrains only)
- `packages/core` ports: `PrReviewReadPort`, `PrReviewWritePort`, `MCPToolPort`, `SidecarRequest`, `SidecarResponse`, `SidecarTransport`
- `packages/mcp`: `ExternalMCPToolAdapter`, `MCPRegistry`
- Team consumer: `teams/team-c/specs/001-pr-review-visualizer-analyzer`

---

## Architecture Constraints (Hexagonal)

This feature MUST conform to hexagonal architecture principles enforced across all packages:

1. **Domain isolation**: `packages/core/src/domain/` contains pure business logic. It depends only on `packages/core/src/ports/` interfaces. It MUST NOT import from adapters, MCP packages, or any external HTTP library.
2. **Port ownership**: All inbound and outbound port interfaces for PR review live in `packages/core/src/ports/pr-review-ports.ts`. They are technology-agnostic. Changing a port signature is a breaking change requiring major version bump.
3. **Adapter boundary**: `ExternalMCPToolAdapter` in `packages/mcp/` is the sole outbound adapter to GitHub. It implements `MCPToolPort`. No other class may directly call the GitHub MCP HTTP endpoint.
4. **Dependency direction**: Domain → Ports ← Adapters. Adapters depend on ports; ports do not depend on adapters. This direction must not be reversed.
5. **Global package constraint**: MCP tools, contracts, and registries are global shared assets under `packages/*`. Team packages (`teams/*/src`) MUST NOT implement or re-implement GitHub MCP adapters.
6. **Transport encapsulation**: `SidecarTransport` is the only coupling point between `ExternalMCPToolAdapter` and IDE-specific transport implementations. Replacing a transport (e.g., swapping HTTP for stdio) must require zero changes to `ExternalMCPToolAdapter`.
