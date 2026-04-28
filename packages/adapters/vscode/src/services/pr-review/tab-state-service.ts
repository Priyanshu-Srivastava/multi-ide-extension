import {
  getActiveTabState,
  resumeTraversalState,
  updateTabState,
  type ReviewSessionState,
  type ReviewTab,
} from '@omni/core';

export function switchToTab(
  session: ReviewSessionState,
  tab: ReviewTab,
  fallbackNodeId: string
): ReviewSessionState {
  return updateTabState(session, tab, (state) => resumeTraversalState(state, fallbackNodeId));
}

export function getTabTraversalSnapshot(
  session: ReviewSessionState,
  tab: ReviewTab
): ReturnType<typeof getActiveTabState> {
  return getActiveTabState(session, tab);
}
