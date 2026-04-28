import type { ReviewCommentDraft } from '@omni/core';

export type CommentSubmitStatus = 'idle' | 'submitting' | 'succeeded' | 'failed';

export interface CommentSubmitState {
  status: CommentSubmitStatus;
  draft: ReviewCommentDraft;
  error?: string;
  retryable: boolean;
}

export function createIdleSubmitState(draft: ReviewCommentDraft): CommentSubmitState {
  return {
    status: 'idle',
    draft,
    retryable: true,
  };
}

export function createSubmittingState(state: CommentSubmitState): CommentSubmitState {
  return {
    ...state,
    status: 'submitting',
    error: undefined,
  };
}

export function createSucceededState(state: CommentSubmitState): CommentSubmitState {
  return {
    ...state,
    status: 'succeeded',
    error: undefined,
    retryable: false,
  };
}

export function createFailedState(state: CommentSubmitState, error: string): CommentSubmitState {
  return {
    ...state,
    status: 'failed',
    error,
    retryable: true,
  };
}
