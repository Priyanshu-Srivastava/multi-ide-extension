# Contract: GitHub PR Read — Request/Response

**Contract ID**: `github-pr-read`  
**Version**: 1.0.0  
**Owner**: controller-pod  
**Tool**: `pull_request_read` (GitHub MCP server v1.0.3)  
**Toolset**: `pull_requests`  
**Read-only**: yes  

---

## Overview

This contract defines the request and response shapes for the `pull_request_read` GitHub MCP tool as used by the PR review feature. All reads go through `ExternalMCPToolAdapter` which wraps calls into `SidecarRequest` → MCP `tools/call` → `SidecarResponse` → `MCPToolResult`.

---

## Common Request Structure

All `pull_request_read` calls are made as `MCPToolInput`:

```typescript
interface MCPToolInput {
  method: string;   // "tools/call"
  params?: {
    name: string;   // "pull_request_read"
    arguments: PullRequestReadArgs;
  };
}
```

### `PullRequestReadArgs` (common fields)

```typescript
interface PullRequestReadArgs {
  method: PullRequestReadMethod;  // required
  owner: string;                  // required — repository owner (user or org)
  repo: string;                   // required — repository name
  pullNumber: number;             // required — PR number
  // Pagination (used by get_files, get_reviews, get_comments, get_check_runs):
  perPage?: number;               // default: 30, max: 100
  page?: number;                  // default: 1
  // Cursor pagination (used by get_review_comments only):
  after?: string;                 // opaque cursor string
}

type PullRequestReadMethod =
  | "get"
  | "get_diff"
  | "get_status"
  | "get_files"
  | "get_review_comments"
  | "get_reviews"
  | "get_comments"
  | "get_check_runs";
```

---

## Method: `get` — PR Metadata

### Request

```json
{
  "method": "tools/call",
  "params": {
    "name": "pull_request_read",
    "arguments": {
      "method": "get",
      "owner": "acme-corp",
      "repo": "backend-api",
      "pullNumber": 42
    }
  }
}
```

### Response — Success

`MCPToolResult.data` contains the parsed `MinimalPullRequest` object:

```typescript
interface MinimalPullRequest {
  number: number;
  title: string;
  state: "open" | "closed" | "merged";
  url: string;             // HTML URL of the PR on GitHub
  headRef: string;         // head branch name
  baseRef: string;         // base branch name
  headSHA: string;         // head commit SHA
  author: {
    login: string;
  };
  body: string | null;     // PR description (sanitised)
  createdAt: string;       // ISO 8601 timestamp
  updatedAt: string;
  draft: boolean;
  labels: Array<{ name: string; color: string }>;
  milestone: { title: string; number: number } | null;
  mergeable: boolean | null;
}
```

**Note**: The GitHub MCP server serialises this as a JSON string in `content[0].text`. `ExternalMCPToolAdapter` returns `MCPToolResult.data` as the already-parsed object.

### Response — Error

```typescript
MCPToolResult {
  success: false,
  error: "failed to get pull request: 404 Not Found"
}
```

---

## Method: `get_diff` — Unified Diff

### Request

```json
{
  "method": "tools/call",
  "params": {
    "name": "pull_request_read",
    "arguments": {
      "method": "get_diff",
      "owner": "acme-corp",
      "repo": "backend-api",
      "pullNumber": 42
    }
  }
}
```

### Response — Success

`MCPToolResult.data` is a raw `string` — the unified diff in standard format:

```
diff --git a/src/foo.ts b/src/foo.ts
index abc123..def456 100644
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -10,6 +10,8 @@
 function existing() {
+  // New line
   return true;
 }
```

**Note**: This is plain text, not JSON. Callers must handle it as a string, not attempt `JSON.parse`.

---

## Method: `get_files` — Changed Files

### Request

```json
{
  "method": "tools/call",
  "params": {
    "name": "pull_request_read",
    "arguments": {
      "method": "get_files",
      "owner": "acme-corp",
      "repo": "backend-api",
      "pullNumber": 42,
      "perPage": 30,
      "page": 1
    }
  }
}
```

### Response — Success

`MCPToolResult.data` is `MinimalPRFile[]`:

```typescript
interface MinimalPRFile {
  filename: string;           // e.g. "src/foo.ts"
  status: "added" | "modified" | "deleted" | "renamed" | "copied" | "changed" | "unchanged";
  additions: number;
  deletions: number;
  changes: number;            // additions + deletions
  patch: string | null;       // unified diff for this file; null for binary files
  previousFilename?: string;  // set when status is "renamed"
}
```

---

## Method: `get_review_comments` — Review Threads

### Request

```json
{
  "method": "tools/call",
  "params": {
    "name": "pull_request_read",
    "arguments": {
      "method": "get_review_comments",
      "owner": "acme-corp",
      "repo": "backend-api",
      "pullNumber": 42,
      "perPage": 20,
      "after": null
    }
  }
}
```

### Response — Success

`MCPToolResult.data` is:

```typescript
interface ReviewThreadsResponse {
  threads: ReviewThread[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string;
    endCursor: string;
  };
  totalCount: number;
}

interface ReviewThread {
  id: string;             // Node ID — "PRRT_kwDOxxx..." (required for resolve/unresolve)
  isResolved: boolean;
  isOutdated: boolean;
  isCollapsed: boolean;
  comments: ReviewThreadComment[];
  totalCommentCount: number;
}

interface ReviewThreadComment {
  id: string;
  body: string;
  path: string;
  line: number | null;
  author: { login: string };
  createdAt: string;
  updatedAt: string;
  url: string;
}
```

---

## Method: `get_reviews` — Review Summaries

### Response — Success

`MCPToolResult.data` is `MinimalPullRequestReview[]`:

```typescript
interface MinimalPullRequestReview {
  id: number;
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED" | "PENDING";
  body: string | null;
  author: { login: string };
  submittedAt: string | null;
  commitId: string | null;
}
```

---

## Method: `get_status` — CI Status

### Response — Success

`MCPToolResult.data` is the GitHub combined status object:

```typescript
interface CombinedStatus {
  state: "success" | "failure" | "pending" | "error";
  statuses: Array<{
    context: string;
    state: string;
    description: string | null;
    targetUrl: string | null;
  }>;
  totalCount: number;
}
```

---

## Method: `get_check_runs` — CI Check Runs

### Response — Success

`MCPToolResult.data` is:

```typescript
interface MinimalCheckRunsResult {
  totalCount: number;
  checkRuns: Array<{
    id: number;
    name: string;
    status: "queued" | "in_progress" | "completed";
    conclusion: "success" | "failure" | "neutral" | "cancelled" | "timed_out" | "action_required" | "skipped" | null;
    url: string;
    startedAt: string | null;
    completedAt: string | null;
  }>;
}
```

---

## Error Handling

All error conditions produce `MCPToolResult { success: false, error: string }`:

| Error Condition | Error Message Pattern |
| --------------- | --------------------- |
| PR not found | `"failed to get pull request: 404 Not Found"` |
| Authentication failure | `"failed to get GitHub client: authentication required"` |
| Rate limit exceeded | `"GitHub API rate limit exceeded. Retry after: <ISO timestamp>"` |
| Network timeout | `"GitHub MCP call timed out after 30s"` |
| Unknown method | `"unknown method: <method>"` |
| Missing required parameter | `"missing required parameter: <name>"` |

---

## Port Mapping

| Port Method | GitHub MCP Tool | `method` param |
| ----------- | --------------- | -------------- |
| `PrReviewReadPort.fetchPullRequestContext()` | `pull_request_read` | `get` |
| `PrReviewReadPort.fetchChangedFiles()` | `pull_request_read` | `get_files` |
| `PrReviewReadPort.fetchFlowNodes()` | `pull_request_read` | `get_files` + static analysis (domain) |
