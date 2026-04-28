# Data Model: PR Review Visualizer and Analyzer

## Entities

### PullRequestContext

- id: string
- repository: string
- pullRequestNumber: number
- baseRef: string
- headRef: string
- snapshotSha: string
- author: string

### ChangedFile

- path: string
- classification: Code | Test
- status: Added | Modified | Deleted | Renamed | Binary
- hunks: DiffHunk[]
- nodeId: string

### DiffHunk

- hunkId: string
- oldStart: number
- oldLines: number
- newStart: number
- newLines: number
- lines: DiffLine[]

### DiffLine

- kind: Added | Removed | Context
- oldLineNumber: number | null
- newLineNumber: number | null
- content: string

### FlowNode

- nodeId: string
- filePath: string
- children: string[]
- parents: string[]
- confidence: number

### TraversalState

- activeTab: Code | Tests
- currentNodeId: string | null
- visitedNodeIds: string[]
- backtrackStack: string[]
- remainingRoots: string[]

### ReviewCommentDraft

- draftId: string
- filePath: string
- line: number
- side: LEFT | RIGHT
- body: string
- updatedAt: string

### PostedReviewComment

- commentId: string
- filePath: string
- line: number
- side: LEFT | RIGHT
- body: string
- status: Submitted | Failed
- errorMessage: string | null

### AIAnalysisNote

- hunkId: string
- intentSummary: string
- downstreamImpact: string
- qualityRisks: string[]
- lowRisk: boolean
- confidence: number

## Relationships

- PullRequestContext 1..* ChangedFile
- ChangedFile 1..1 FlowNode
- ChangedFile 0..* DiffHunk
- DiffHunk 1..1 AIAnalysisNote
- TraversalState references FlowNode by nodeId
- ReviewCommentDraft and PostedReviewComment reference ChangedFile and line mapping

## Invariants

- A TraversalState must maintain deterministic next-node choice for the same snapshotSha.
- A PostedReviewComment must map to exactly one file path and line target.
- A DiffHunk with visible lines must have an AIAnalysisNote.
- Cycle detection must prevent revisiting already visited nodeIds within one traversal path.
