import {
  classifyFilePath,
  createEmptySessionState,
  initializeTraversal,
  saveCommentDraft,
  selectEntryPoint,
  updateTabState,
  type FlowNode,
  type PrReviewAnalysisPort,
  type PrReviewReadPort,
  type PrReviewWritePort,
  type ReviewCommentDraft,
  type ReviewSessionState,
  type ReviewTab,
} from '@omni/core';

export interface PrReviewDependencies {
  readPort: PrReviewReadPort;
  writePort: PrReviewWritePort;
  analysisPort: PrReviewAnalysisPort;
  globalDependencyApproved: boolean;
}

export interface StartReviewInput {
  repository: string;
  pullRequestNumber: number;
  tab: ReviewTab;
  entryPointNodeId?: string;
}

export interface TeamCPrReviewFeature {
  startReview(input: StartReviewInput): Promise<ReviewSessionState>;
  saveDraft(session: ReviewSessionState, draft: ReviewCommentDraft): Promise<ReviewSessionState>;
}

function enforceGlobalDependencyApproval(approved: boolean): void {
  if (!approved) {
    throw new Error('Global MCP dependency review is not approved yet.');
  }
}

function pickTabNodes(nodes: FlowNode[], tab: ReviewTab): FlowNode[] {
  return nodes.filter((node) => classifyFilePath(node.filePath) === tab);
}

export function createTeamCPrReviewFeature(deps: PrReviewDependencies): TeamCPrReviewFeature {
  return {
    async startReview(input: StartReviewInput): Promise<ReviewSessionState> {
      enforceGlobalDependencyApproval(deps.globalDependencyApproved);

      const pr = await deps.readPort.fetchPullRequestContext(input.repository, input.pullRequestNumber);
      const changedFiles = await deps.readPort.fetchChangedFiles(input.repository, input.pullRequestNumber);
      const nodes = await deps.readPort.fetchFlowNodes(
        input.repository,
        changedFiles.map((file) => file.path)
      );

      const scopedNodes = pickTabNodes(nodes, input.tab);
      const selection = selectEntryPoint(scopedNodes, input.entryPointNodeId);

      const session = createEmptySessionState(
        `${input.repository}#${input.pullRequestNumber}`,
        pr
      );

      return updateTabState(session, input.tab, () => initializeTraversal(selection.nodeId, input.tab));
    },

    async saveDraft(session: ReviewSessionState, draft: ReviewCommentDraft): Promise<ReviewSessionState> {
      return saveCommentDraft(session, draft);
    },
  };
}
