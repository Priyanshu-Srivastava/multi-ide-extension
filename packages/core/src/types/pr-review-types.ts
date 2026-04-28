export type FileClassification = 'code' | 'test';
export type DiffLineKind = 'added' | 'removed' | 'context';
export type CommentSide = 'LEFT' | 'RIGHT';
export type ReviewTab = 'code' | 'tests';

export interface PullRequestContext {
  repository: string;
  pullRequestNumber: number;
  title?: string;
  baseRef?: string;
  headRef?: string;
  snapshotSha?: string;
}

export interface DiffLine {
  kind: DiffLineKind;
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffHunk {
  hunkId: string;
  filePath: string;
  oldStart: number;
  newStart: number;
  lines: DiffLine[];
}

export interface ChangedFile {
  path: string;
  classification: FileClassification;
  hunks: DiffHunk[];
}

export interface FlowNode {
  nodeId: string;
  filePath: string;
  childNodeIds: string[];
  confidence?: number;
}

export interface TraversalState {
  tab: ReviewTab;
  rootNodeId?: string;
  currentNodeId?: string;
  visitedNodeIds: string[];
  backtrackStack: string[];
}

export interface AIAnalysisNote {
  hunkId: string;
  intentSummary: string;
  downstreamImpact: string;
  qualityRisks: string[];
  lowRisk: boolean;
  confidence: number;
}

export interface ReviewCommentDraft {
  draftId: string;
  filePath: string;
  line: number;
  side: CommentSide;
  body: string;
  updatedAtIso: string;
}

export interface PostedReviewComment {
  commentId: string;
  filePath: string;
  line: number;
  side: CommentSide;
  body: string;
}

export interface ReviewSessionState {
  sessionId: string;
  pullRequest: PullRequestContext;
  tabs: Record<ReviewTab, TraversalState>;
  drafts: Record<string, ReviewCommentDraft>;
}

export interface EntryPointSelection {
  nodeId: string;
  reason: 'manual-override' | 'highest-confidence' | 'lexical-tie-break';
}

export interface TraversalPosition {
  currentNodeId?: string;
  completed: boolean;
}
