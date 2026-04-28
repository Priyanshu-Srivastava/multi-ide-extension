import type {
  AIAnalysisNote,
  ChangedFile,
  FlowNode,
  PostedReviewComment,
  PullRequestContext,
  ReviewCommentDraft,
} from '../types/pr-review-types';

export interface PrReviewReadPort {
  fetchPullRequestContext(repository: string, pullRequestNumber: number): Promise<PullRequestContext>;
  fetchChangedFiles(repository: string, pullRequestNumber: number): Promise<ChangedFile[]>;
  fetchFlowNodes(repository: string, changedFilePaths: string[]): Promise<FlowNode[]>;
}

export interface PrReviewWritePort {
  submitLineComment(repository: string, pullRequestNumber: number, draft: ReviewCommentDraft): Promise<PostedReviewComment>;
}

export interface PrReviewAnalysisPort {
  analyzeDiffHunk(filePath: string, hunkId: string): Promise<AIAnalysisNote>;
}
