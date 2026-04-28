import type { ReviewSessionState, ReviewTab, TraversalState } from '../../types/pr-review-types';

function emptyTraversal(tab: ReviewTab): TraversalState {
  return {
    tab,
    visitedNodeIds: [],
    backtrackStack: [],
  };
}

export function createEmptySessionState(sessionId: string, pullRequest: ReviewSessionState['pullRequest']): ReviewSessionState {
  return {
    sessionId,
    pullRequest,
    drafts: {},
    tabs: {
      code: emptyTraversal('code'),
      tests: emptyTraversal('tests'),
    },
  };
}

export function updateTabState(
  session: ReviewSessionState,
  tab: ReviewTab,
  updater: (state: TraversalState) => TraversalState
): ReviewSessionState {
  return {
    ...session,
    tabs: {
      ...session.tabs,
      [tab]: updater(session.tabs[tab]),
    },
  };
}

export function getActiveTabState(session: ReviewSessionState, tab: ReviewTab): TraversalState {
  return session.tabs[tab];
}

export function resumeTraversalState(
  state: TraversalState,
  fallbackNodeId: string
): TraversalState {
  const visited = [...state.visitedNodeIds];
  const stack = [...state.backtrackStack];

  const currentNodeId = state.currentNodeId ?? fallbackNodeId;
  if (!visited.includes(currentNodeId)) {
    visited.push(currentNodeId);
  }

  if (stack.length === 0) {
    stack.push(currentNodeId);
  } else if (!stack.includes(currentNodeId)) {
    stack.push(currentNodeId);
  }

  return {
    ...state,
    rootNodeId: state.rootNodeId ?? fallbackNodeId,
    currentNodeId,
    visitedNodeIds: visited,
    backtrackStack: stack,
  };
}
