import {
  getCommentDraft,
  removeCommentDraft,
  validateCommentTarget,
  type ChangedFile,
  type PostedReviewComment,
  type PrReviewWritePort,
  type ReviewSessionState,
} from '@omni/core';
import {
  createFailedState,
  createIdleSubmitState,
  createSubmittingState,
  createSucceededState,
  type CommentSubmitState,
} from './comment-submit-state';

export interface SubmitCommentResult {
  state: CommentSubmitState;
  posted?: PostedReviewComment;
  session: ReviewSessionState;
}

export async function submitDraftComment(
  port: PrReviewWritePort,
  repository: string,
  pullRequestNumber: number,
  draftId: string,
  session: ReviewSessionState,
  changedFiles: ChangedFile[]
): Promise<SubmitCommentResult> {
  const draft = getCommentDraft(session, draftId);
  if (!draft) {
    throw new Error(`Draft ${draftId} does not exist.`);
  }

  let state = createIdleSubmitState(draft);

  if (!validateCommentTarget(draft, changedFiles)) {
    return {
      state: createFailedState(state, 'Invalid line/file mapping for this pull request snapshot.'),
      session,
    };
  }

  state = createSubmittingState(state);

  try {
    const posted = await port.submitLineComment(repository, pullRequestNumber, draft);
    return {
      state: createSucceededState(state),
      posted,
      session: removeCommentDraft(session, draftId),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      state: createFailedState(state, message),
      session,
    };
  }
}
