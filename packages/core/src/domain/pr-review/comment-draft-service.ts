import type { ReviewCommentDraft, ReviewSessionState } from '../../types/pr-review-types';

export function saveCommentDraft(session: ReviewSessionState, draft: ReviewCommentDraft): ReviewSessionState {
  return {
    ...session,
    drafts: {
      ...session.drafts,
      [draft.draftId]: draft,
    },
  };
}

export function getCommentDraft(session: ReviewSessionState, draftId: string): ReviewCommentDraft | undefined {
  return session.drafts[draftId];
}

export function removeCommentDraft(session: ReviewSessionState, draftId: string): ReviewSessionState {
  const drafts = { ...session.drafts };
  delete drafts[draftId];

  return {
    ...session,
    drafts,
  };
}
