# Quickstart: GitHub MCP Integration - PR Review Shared Infrastructure

This guide validates the controller-pod global integration for VS Code, Cursor, and JetBrains.

## Prerequisites

- Node.js 20+
- npm workspaces installed (`npm install` at repo root)
- Valid GitHub access (`repo` scope)
- For JetBrains path: Docker Engine/Desktop installed and running

## 1) Validate Specs and Artifacts

From repo root:

```powershell
node scripts/validate-spec.js
```

Expected result: `SpecKit validation passed for team and global features`.

## 2) VS Code / Cursor Path (Remote HTTP)

### Authentication

Preferred: VS Code GitHub OAuth session (VS Code 1.101+).  
Fallback: set PAT in environment:

```powershell
$env:GITHUB_PERSONAL_ACCESS_TOKEN="<your_token_with_repo_scope>"
```

### MCP Configuration (optional/manual)

Add/verify in `.vscode/mcp.json`:

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

### Smoke Test Checklist

- Open extension host.
- Confirm registry lists tools:
  - `github.pull_request_read`
  - `github.list_pull_requests`
  - `github.pull_request_review_write`
  - `github.add_comment_to_pending_review`
- Trigger PR context load via feature UI.
- Confirm response is populated in <= 5s for a normal PR.
- Verify structured logs include `correlationId` across adapter + registry.

## 3) JetBrains Path (Local Docker sidecar)

Set PAT:

```powershell
$env:GITHUB_PERSONAL_ACCESS_TOKEN="<your_token_with_repo_scope>"
$env:OMNI_SIDECAR_PORT="7654"
```

Bridge uses Docker image:

```text
ghcr.io/github/github-mcp-server:v1.0.3
```

### Start adapter/sidecar and health check

- Launch JetBrains adapter host.
- Verify health endpoint:

```text
GET http://localhost:7654/health
```

Expected: status ok + registered GitHub tools.

### RPC smoke call

```json
POST /rpc
{
  "method": "tools/call",
  "params": {
    "name": "pull_request_read",
    "arguments": {
      "method": "get",
      "owner": "<owner>",
      "repo": "<repo>",
      "pullNumber": 1
    }
  }
}
```

Expected: `acknowledged=true` and MCP call result payload.

## 4) Write Flow Validation

Sequence:

1. `pull_request_review_write` with `method=create` (pending review)
2. `add_comment_to_pending_review`
3. `pull_request_review_write` with `method=submit_pending`

Expected:
- Success response messages as defined in contracts.
- Subsequent `pull_request_read` (`method=get_review_comments`) includes submitted comment.

## 5) Error and Observability Checks

Validate each scenario:

- Missing auth -> explicit failure message (no crash)
- Invalid line mapping -> write failure with clear error text
- Timeout (>30s) -> timeout error response
- Rate limit -> failure contains retry guidance

Observability expectations:
- Logs include `toolId`, `ide`, `operation`, `status`, `durationMs`, `correlationId`
- Metrics increment for success/failure/timeout and latency buckets
- Same `correlationId` visible across adapter -> registry -> sidecar/transport logs

### Observability Verification Procedure

1. Trigger one successful read call (`pull_request_read` with `method=get`) and one intentional failing call (invalid PR number).
2. Capture logs from adapter host and sidecar output stream.
3. Confirm both calls include the same `correlationId` value in every layer for each request.
4. Confirm one `mcp_calls_success_total` increment and one `mcp_calls_failure_total` increment.
5. Confirm timeout failures increment `mcp_timeout_total` when using a forced slow request (>30s).

Expected log shape:

```text
{ "toolId":"github.pull_request_read", "ide":"vscode", "operation":"tools/call", "status":"success", "durationMs":321, "correlationId":"corr-123" }
{ "toolId":"github.pull_request_read", "ide":"jetbrains", "operation":"tools/call", "status":"failure", "errorCode":408, "correlationId":"corr-456" }
```

Expected metric shape:

```text
mcp_calls_total{toolId="github.pull_request_read",ide="vscode",status="success"}
mcp_calls_failure_total{toolId="github.pull_request_read",ide="jetbrains",errorClass="transient"}
mcp_timeout_total{toolId="github.pull_request_read",ide="jetbrains"}
```

## 6) Build/Lint Gates

```powershell
npm run build
npm run lint
```

All changed packages should pass before implementation merge.
