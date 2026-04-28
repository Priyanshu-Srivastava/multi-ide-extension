# Contract: GitHub MCP Outbound Port

## Purpose

Defines outbound capabilities for PR retrieval and review comment posting through global MCP integration.

## Operations

### fetchPullRequestContext(input)

- Input:
  - repository: string
  - pullRequestNumber: number
- Output:
  - PullRequestContext

### fetchChangedFiles(input)

- Input:
  - repository: string
  - pullRequestNumber: number
- Output:
  - ChangedFile[]

### fetchFileDiffs(input)

- Input:
  - repository: string
  - pullRequestNumber: number
  - filePaths: string[]
- Output:
  - DiffHunk[] grouped by file

### submitLineComment(input)

- Input:
  - repository: string
  - pullRequestNumber: number
  - filePath: string
  - line: number
  - side: LEFT | RIGHT
  - body: string
- Output:
  - commentId: string
  - submitted: boolean
  - error: string | null

## Failure Modes

- RateLimitExceeded: Caller should retry with backoff.
- NotFoundOrOutdatedLine: Caller should request refresh and remap target line.
- PermissionDenied: Caller should surface actionable auth/permission feedback.
- TransportFailure: Caller should preserve drafts and allow retry.

## Constraints

- This contract is consumed through global MCP registry paths in shared packages.
- Team-scoped feature code must not implement private MCP tool logic.
