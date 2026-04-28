import assert from 'node:assert/strict';
import test from 'node:test';
import { submitDraftComment } from '../comment-submit-service';
import type { ChangedFile, PrReviewWritePort, ReviewSessionState } from '@omni/core';

function createSession(): ReviewSessionState {
  return {
    sessionId: 'session-1',
    pullRequest: { repository: 'owner/repo', pullRequestNumber: 10 },
    tabs: {
      code: { tab: 'code', visitedNodeIds: [], backtrackStack: [] },
      tests: { tab: 'tests', visitedNodeIds: [], backtrackStack: [] },
    },
    drafts: {
      draft1: {
        draftId: 'draft1',
        filePath: 'src/index.ts',
        line: 5,
        side: 'RIGHT',
        body: 'Looks good',
        updatedAtIso: new Date(0).toISOString(),
      },
    },
  };
}

const changedFiles: ChangedFile[] = [
  {
    path: 'src/index.ts',
    classification: 'code',
    hunks: [
      {
        hunkId: 'h1',
        filePath: 'src/index.ts',
        oldStart: 4,
        newStart: 4,
        lines: [
          { kind: 'context', content: ' const a = 1;', oldLineNumber: 4, newLineNumber: 4 },
          { kind: 'added', content: '+const b = 2;', newLineNumber: 5 },
        ],
      },
    ],
  },
];

test('submitDraftComment posts valid draft and removes it from session', async () => {
  const port: PrReviewWritePort = {
    async submitLineComment(_repository, _pullRequestNumber, draft) {
      return {
        commentId: 'c1',
        filePath: draft.filePath,
        line: draft.line,
        side: draft.side,
        body: draft.body,
      };
    },
  };

  const result = await submitDraftComment(port, 'owner/repo', 10, 'draft1', createSession(), changedFiles);
  assert.equal(result.state.status, 'succeeded');
  assert.equal(result.posted?.commentId, 'c1');
  assert.equal(result.session.drafts.draft1, undefined);
});

test('submitDraftComment preserves draft when submission fails', async () => {
  const port: PrReviewWritePort = {
    async submitLineComment() {
      throw new Error('Rate limit reached');
    },
  };

  const result = await submitDraftComment(port, 'owner/repo', 10, 'draft1', createSession(), changedFiles);
  assert.equal(result.state.status, 'failed');
  assert.equal(result.state.retryable, true);
  assert.ok(result.session.drafts.draft1);
});

test('submitDraftComment fails fast for invalid line mapping', async () => {
  const port: PrReviewWritePort = {
    async submitLineComment() {
      throw new Error('Should not be called');
    },
  };

  const invalidFiles: ChangedFile[] = [
    {
      path: 'src/other.ts',
      classification: 'code',
      hunks: [],
    },
  ];

  const result = await submitDraftComment(port, 'owner/repo', 10, 'draft1', createSession(), invalidFiles);
  assert.equal(result.state.status, 'failed');
  assert.match(result.state.error ?? '', /Invalid line\/file mapping/);
  assert.ok(result.session.drafts.draft1);
});
