# Contract: PR Review Inbound Port

## Purpose

Defines feature-facing operations to drive PR review visualization and analysis independent of adapter implementation.

## Operations

### loadReviewSession(input)

- Input:
  - repository: string
  - pullRequestNumber: number
  - tab: Code | Tests
  - optionalEntryPointPath: string | null
- Output:
  - sessionId: string
  - currentFile: ChangedFileView | null
  - traversalState: TraversalState

### nextFile(input)

- Input:
  - sessionId: string
- Output:
  - currentFile: ChangedFileView | null
  - traversalState: TraversalState

### previousFile(input)

- Input:
  - sessionId: string
- Output:
  - currentFile: ChangedFileView | null
  - traversalState: TraversalState

### switchTab(input)

- Input:
  - sessionId: string
  - tab: Code | Tests
- Output:
  - currentFile: ChangedFileView | null
  - traversalState: TraversalState

### saveDraftComment(input)

- Input:
  - sessionId: string
  - draft: ReviewCommentDraft
- Output:
  - saved: boolean

### submitComment(input)

- Input:
  - sessionId: string
  - draftId: string
- Output:
  - result: PostedReviewComment

## Behavioral Guarantees

- Traversal order is deterministic for a stable PR snapshot.
- Tab state is isolated between Code and Tests.
- Failed submission preserves draft for retry.
