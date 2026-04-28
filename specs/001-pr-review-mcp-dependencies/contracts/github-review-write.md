# Contract: GitHub Review Write — Request/Response

**Contract ID**: `github-review-write`  
**Version**: 1.0.0  
**Owner**: controller-pod  
**Tools**: `pull_request_review_write`, `add_comment_to_pending_review` (GitHub MCP server v1.0.3)  
**Toolset**: `pull_requests`  
**Read-only**: no  

---

## Overview

This contract defines the full review write workflow: creating a pending review, adding line comments to it, and submitting or discarding it. It also covers review thread management (resolve/unresolve).

**Workflow sequence** (standard review submission):
1. Call `pull_request_review_write` with `method: "create"` and no `event` → creates pending review.
2. Call `add_comment_to_pending_review` one or more times → attaches line comments.
3. Call `pull_request_review_write` with `method: "submit_pending"` and `event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT"` → submits the review.

---

## Tool: `pull_request_review_write`

### Method: `create` — Create (and optionally submit) a Review

#### Request

```json
{
  "method": "tools/call",
  "params": {
    "name": "pull_request_review_write",
    "arguments": {
      "method": "create",
      "owner": "acme-corp",
      "repo": "backend-api",
      "pullNumber": 42,
      "body": "Overall this looks good, see inline comments.",
      "event": "COMMENT",
      "commitID": "abc1234"
    }
  }
}
```

**To create a pending review without submitting**, omit `event`:
```json
{
  "method": "create",
  "owner": "acme-corp",
  "repo": "backend-api",
  "pullNumber": 42
}
```

#### Parameters

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `method` | `"create"` | yes | Fixed value |
| `owner` | `string` | yes | Repository owner |
| `repo` | `string` | yes | Repository name |
| `pullNumber` | `number` | yes | PR number |
| `body` | `string` | optional | Review comment text (summary comment) |
| `event` | `"APPROVE" \| "REQUEST_CHANGES" \| "COMMENT"` | optional | If omitted, creates a pending review |
| `commitID` | `string` | optional | SHA of the commit to review against |

#### Response — Create Pending

```typescript
MCPToolResult {
  success: true,
  data: "pending pull request created"
}
```

#### Response — Create and Submit Immediately

```typescript
MCPToolResult {
  success: true,
  data: "pull request review submitted successfully"
}
```

---

### Method: `submit_pending` — Submit Existing Pending Review

#### Request

```json
{
  "method": "tools/call",
  "params": {
    "name": "pull_request_review_write",
    "arguments": {
      "method": "submit_pending",
      "owner": "acme-corp",
      "repo": "backend-api",
      "pullNumber": 42,
      "event": "APPROVE",
      "body": "LGTM!"
    }
  }
}
```

#### Parameters

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `method` | `"submit_pending"` | yes | Fixed value |
| `owner` | `string` | yes | Repository owner |
| `repo` | `string` | yes | Repository name |
| `pullNumber` | `number` | yes | PR number |
| `event` | `"APPROVE" \| "REQUEST_CHANGES" \| "COMMENT"` | yes | Review decision |
| `body` | `string` | optional | Summary comment for the review |

#### Response — Success

```typescript
MCPToolResult {
  success: true,
  data: "pending pull request review successfully submitted"
}
```

#### Response — No Pending Review

```typescript
MCPToolResult {
  success: false,
  error: "No pending review found for the viewer"
}
```

---

### Method: `delete_pending` — Delete Pending Review

#### Request

```json
{
  "method": "delete_pending",
  "owner": "acme-corp",
  "repo": "backend-api",
  "pullNumber": 42
}
```

#### Response — Success

```typescript
MCPToolResult {
  success: true,
  data: "pending pull request review successfully deleted"
}
```

---

### Method: `resolve_thread` — Resolve a Review Thread

#### Request

```json
{
  "method": "tools/call",
  "params": {
    "name": "pull_request_review_write",
    "arguments": {
      "method": "resolve_thread",
      "owner": "acme-corp",
      "repo": "backend-api",
      "pullNumber": 42,
      "threadId": "PRRT_kwDOBQnxPM4BjW8v"
    }
  }
}
```

**Note**: `owner`, `repo`, and `pullNumber` are passed in the request but are not used for resolve/unresolve operations (the GitHub GraphQL mutation uses `threadId` only). They must be present because the tool schema requires them.

#### Parameters

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `method` | `"resolve_thread"` | yes | Fixed value |
| `owner` | `string` | yes | Required by schema (not used in mutation) |
| `repo` | `string` | yes | Required by schema (not used in mutation) |
| `pullNumber` | `number` | yes | Required by schema (not used in mutation) |
| `threadId` | `string` | yes | Node ID of the review thread (`PRRT_kwDO...`) |

#### Response — Success

```typescript
MCPToolResult {
  success: true,
  data: "review thread resolved successfully"
}
```

**Idempotent**: Resolving an already-resolved thread is a no-op (no error).

---

### Method: `unresolve_thread` — Unresolve a Review Thread

Identical request shape to `resolve_thread` with `method: "unresolve_thread"`.

#### Response — Success

```typescript
MCPToolResult {
  success: true,
  data: "review thread unresolved successfully"
}
```

---

## Tool: `add_comment_to_pending_review`

### Overview

Adds a single line-level or file-level comment to the current user's pending review. The pending review must already exist before this tool is called (use `pull_request_review_write` with `method: "create"` first).

### Request — Line Comment

```json
{
  "method": "tools/call",
  "params": {
    "name": "add_comment_to_pending_review",
    "arguments": {
      "owner": "acme-corp",
      "repo": "backend-api",
      "pullNumber": 42,
      "path": "src/services/auth.ts",
      "body": "This method should handle the null case explicitly.",
      "subjectType": "LINE",
      "line": 87,
      "side": "RIGHT"
    }
  }
}
```

### Request — Multi-line Comment

```json
{
  "owner": "acme-corp",
  "repo": "backend-api",
  "pullNumber": 42,
  "path": "src/services/auth.ts",
  "body": "This entire block can be simplified.",
  "subjectType": "LINE",
  "startLine": 82,
  "startSide": "RIGHT",
  "line": 90,
  "side": "RIGHT"
}
```

### Request — File-level Comment

```json
{
  "owner": "acme-corp",
  "repo": "backend-api",
  "pullNumber": 42,
  "path": "src/services/auth.ts",
  "body": "This file needs additional unit tests.",
  "subjectType": "FILE"
}
```

### Parameters

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `owner` | `string` | yes | Repository owner |
| `repo` | `string` | yes | Repository name |
| `pullNumber` | `number` | yes | PR number |
| `path` | `string` | yes | Relative file path (e.g., `src/foo.ts`) |
| `body` | `string` | yes | Comment text |
| `subjectType` | `"FILE" \| "LINE"` | yes | Target level |
| `line` | `number` | optional | Target line number in diff (last line for multi-line) |
| `side` | `"LEFT" \| "RIGHT"` | optional | `LEFT` = previous state, `RIGHT` = new state |
| `startLine` | `number` | optional | First line for multi-line comments |
| `startSide` | `"LEFT" \| "RIGHT"` | optional | Side for multi-line start |

### Response — Success

```typescript
MCPToolResult {
  success: true,
  data: "pull request review comment successfully added to pending review"
}
```

### Response — Invalid Line

```typescript
MCPToolResult {
  success: false,
  error: "Failed to add comment to pending review. Possible reasons:\n- The line number doesn't exist in the pull request diff\n- The file path is incorrect\n- The side (LEFT/RIGHT) is invalid for the specified line"
}
```

### Response — No Pending Review

```typescript
MCPToolResult {
  success: false,
  error: "No pending review found for the viewer"
}
```

---

## Port Mapping

| Port Method | GitHub MCP Tool | `method` param | Notes |
| ----------- | --------------- | -------------- | ----- |
| `PrReviewWritePort.submitLineComment()` | `pull_request_review_write` (create) → `add_comment_to_pending_review` → `pull_request_review_write` (submit) | `create` → N/A → `submit_pending` | Full 3-step workflow |

---

## Error Handling Summary

| Error Condition | Tool | Error Pattern |
| --------------- | ---- | ------------- |
| No pending review exists | `add_comment_to_pending_review` | `"No pending review found for the viewer"` |
| Invalid line number | `add_comment_to_pending_review` | Multi-line failure description |
| Latest review is not pending | `submit_pending` / `delete_pending` | `"The latest review, found at <url> is not pending"` |
| Missing `threadId` for resolve | `pull_request_review_write` | `"threadId is required for resolve_thread..."` |
| Unknown method value | Both tools | `"unknown method: <value>"` |
| Auth failure | Both tools | `"failed to get GitHub client: ..."` |
