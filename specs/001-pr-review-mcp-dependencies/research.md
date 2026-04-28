# Research Log: GitHub MCP Integration — PR Review Shared Infrastructure

**Feature**: `specs/001-pr-review-mcp-dependencies`  
**Researcher**: controller-pod team  
**Research Date**: 2026-04-28  

---

## Decision Log

### DEC-001 — Remote HTTP vs Local stdio for VS Code and Cursor

**Question**: Should VS Code and Cursor use the GitHub MCP remote HTTP server or spawn a local process?

**Options considered**:

| Option | Pros | Cons |
| ------ | ---- | ---- |
| Remote HTTP (`https://api.githubcopilot.com/mcp/`) | No local install required; OAuth works natively in VS Code 1.101+; toolset filtering via headers | Requires internet connectivity; subject to GitHub API rate limits |
| Local stdio (Docker or binary) | Works offline; lower latency | Requires Docker or Go binary installed; more complex activation code |

**Decision**: Remote HTTP for VS Code and Cursor.

**Rationale**: VS Code 1.101+ supports native OAuth for GitHub, making the remote server the zero-friction option for the target user base. The remote server also supports fine-grained toolset filtering via `X-MCP-Toolsets` and `X-MCP-Readonly` headers, enabling read-only enforcement without code changes. Local stdio remains available as a fallback documented in the developer guide.

**Source**: `github/github-mcp-server` README; server-configuration.md; VS Code 1.101 release notes on MCP HTTP support.

---

### DEC-002 — Local Docker stdio for JetBrains

**Question**: How should JetBrains connect to the GitHub MCP server given it cannot use VS Code extension APIs?

**Options considered**:

| Option | Pros | Cons |
| ------ | ---- | ---- |
| Docker stdio (local container) | Official GitHub-supported approach; image pinnable; works with PAT | Requires Docker Desktop; slower first-call (image pull) |
| Local binary (go run or pre-built) | No Docker dependency | Requires Go toolchain or platform-specific binary distribution |
| Remote HTTP via custom HTTP client | Same server as VS Code | No native OAuth in JetBrains; PAT in HTTP header is less secure; CORS concerns |

**Decision**: Docker stdio for JetBrains.

**Rationale**: Docker Desktop is a common developer prerequisite in enterprise environments where JetBrains IDEs are most used. The official `ghcr.io/github/github-mcp-server` Docker image is the GitHub-recommended approach for environments without native OAuth. Image pinning (`v1.0.3`) ensures reproducible behaviour.

**Source**: `github/github-mcp-server` installation guides; JetBrains MCP documentation (GitHub Copilot for other IDEs plugin); existing sidecar HTTP bridge pattern in `packages/adapters/jetbrains/`.

---

### DEC-003 — OAuth vs PAT as Primary Authentication for VS Code

**Question**: Should the implementation require OAuth or PAT as the default authentication method for VS Code?

**Decision**: OAuth primary, PAT fallback.

**Rationale**: VS Code 1.101+ ships built-in GitHub OAuth. Using `vscode.authentication.getSession("github", ["repo"])` requires no user-visible credential management — the IDE handles token acquisition and renewal. PAT fallback is included for environments where OAuth is blocked (corporate proxies, older VS Code versions, CI contexts).

**Risk**: OAuth scope challenges are asynchronous — if the user has not granted `repo` scope, the first tool call triggers a VS Code permission dialog. This is expected behaviour and must be documented.

---

### DEC-004 — Toolset Scoping: `pull_requests,context` vs full default

**Question**: Which GitHub MCP toolsets should be enabled for the PR review feature?

**Decision**: `pull_requests` + `context` toolsets only.

**Rationale**: The PR review feature needs: PR metadata, diff, file list, review comments, review submission. All of these are in `pull_requests`. The `context` toolset provides `get_me` for user identity (needed to determine review authorship). Enabling the full default (`context,issues,pull_requests,repos,users`) would register ~30+ tools unnecessarily, bloating the AI context window and increasing the surface area for unintended operations.

**Excluded toolsets**: `issues`, `repos`, `users` — not required for PR review.

---

### DEC-005 — Read-only enforcement for read operations

**Question**: Should `X-MCP-Readonly: true` be enforced at the transport layer for read operations?

**Decision**: Yes. Read transport uses `X-MCP-Readonly: true`; write transport omits it.

**Rationale**: Enforcing read-only at the transport layer is a defence-in-depth measure. Even if a future code change accidentally calls a write tool through the read transport, the GitHub MCP server will reject it. Two separate `ExternalMCPToolAdapter` instances are registered: one for read tools (with readonly header), one for write tools (without). This aligns with the "security by default" principle from the server-configuration guide.

---

### DEC-006 — Single persistent process vs per-call process for JetBrains sidecar

**Question**: Should `JetBrainsSidecarBridge` spawn a new Docker container per RPC call or maintain a persistent process?

**Decision**: Single persistent process per sidecar session.

**Rationale**: Docker container startup takes 2–5 seconds. Spawning per call would make every GitHub data fetch user-perceptibly slow. A persistent process also allows the GitHub MCP server's internal connection state (OAuth sessions, internal caching) to be reused across calls. The trade-off is that the bridge must handle process lifecycle (restart on crash, graceful shutdown on deactivation). This complexity is contained within `JetBrainsSidecarBridge` and is transparent to callers.

---

### DEC-007 — `ExternalMCPToolAdapter` reuse vs new GitHub-specific adapter

**Question**: Should the integration use the existing `ExternalMCPToolAdapter` or create a new GitHub-specific adapter?

**Decision**: Reuse `ExternalMCPToolAdapter` with IDE-specific `SidecarTransport` implementations.

**Rationale**: `ExternalMCPToolAdapter` already implements the `MCPToolPort` interface and handles JSON-RPC 2.0 request/response mapping. The `SidecarTransport` function type is the designed extension point for different transport mechanisms. Creating a new adapter would duplicate the existing machinery and violate the single-responsibility principle. The only new code needed is the transport function for each IDE.

**Source**: `packages/mcp/src/registry/external-adapter.ts` — constructor signature and `execute()` implementation reviewed directly.

---

## Tool Inventory (from `github/github-mcp-server` v1.0.3 source)

Tools confirmed in the `pull_requests` toolset relevant to PR review:

| Tool Name | Read-Only | Primary Use |
| --------- | --------- | ----------- |
| `list_pull_requests` | yes | List PRs in a repository |
| `pull_request_read` | yes | Fetch PR metadata, diff, files, review comments, reviews, check runs |
| `pull_request_review_write` | no | Create/submit/delete reviews; resolve/unresolve threads |
| `add_comment_to_pending_review` | no | Add line-level comment to a pending review |
| `update_pull_request` | no | Update PR title/body/state/reviewers (out of scope for PR review feature) |
| `merge_pull_request` | no | Merge a PR (out of scope for PR review feature) |
| `create_pull_request` | no | Create a new PR (out of scope for PR review feature) |
| `update_pull_request_branch` | no | Update PR branch (out of scope for PR review feature) |
| `add_reply_to_pull_request_comment` | no | Reply to existing comment (potential future scope) |
| `search_pull_requests` | yes | Search PRs by query (potential future scope) |

**In scope for this feature**: `list_pull_requests`, `pull_request_read`, `pull_request_review_write`, `add_comment_to_pending_review`.

---

## MCP Protocol Observations

- GitHub MCP server uses JSON-RPC 2.0 over stdio (local) or HTTP POST (remote).
- Tool calls use method `tools/call`; tool discovery uses `tools/list`.
- Response content type is always `content[].type = "text"` for this server; `structuredContent` is not used in v1.0.3.
- Error responses set `isError: true` in the `CallToolResult`; they do NOT use JSON-RPC `error` field for tool-execution errors (only for protocol-level errors).
- `pull_request_read` is a multi-method tool — one registered MCP tool name handles 8 different operations via a `method` parameter. This is a GitHub MCP server design choice, not standard MCP.
- Response payloads for `get`, `get_files`, `get_reviews`, `get_review_comments` are JSON strings serialised as plain text (not structured JSON in `content`). Callers must `JSON.parse(content[0].text)`.
- Response payload for `get_diff` is a raw unified diff string — not JSON.

---

## Rejected Approaches

- **Team-scoped MCP tool implementations**: Rejected unconditionally. Constitution and FR-004 forbid team packages from implementing GitHub MCP adapters.
- **GraphQL direct calls from domain**: Rejected. Domain must remain port-bound. Direct Octokit/GraphQL calls in domain code would couple business logic to GitHub API internals.
- **Polling for PR updates**: Out of scope. Real-time PR update notifications via webhooks are a future enhancement, not part of this feature.
- **Fine-grained PAT for JetBrains**: Not blocked, but fine-grained tokens (`github_pat_` prefix) do not undergo scope filtering at startup. Classic PATs (`ghp_` prefix) are recommended for predictable tool visibility.
