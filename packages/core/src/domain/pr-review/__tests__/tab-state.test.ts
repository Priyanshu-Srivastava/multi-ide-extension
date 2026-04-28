import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptySessionState, updateTabState } from '../traversal-state';

const pullRequest = { repository: 'owner/repo', pullRequestNumber: 1 };

test('code and tests tabs keep independent traversal state', () => {
  let session = createEmptySessionState('session-1', pullRequest);

  session = updateTabState(session, 'code', (state) => ({
    ...state,
    currentNodeId: 'flow:src/a.ts',
    visitedNodeIds: ['flow:src/a.ts'],
    backtrackStack: ['flow:src/a.ts'],
  }));

  session = updateTabState(session, 'tests', (state) => ({
    ...state,
    currentNodeId: 'flow:test/a.test.ts',
    visitedNodeIds: ['flow:test/a.test.ts'],
    backtrackStack: ['flow:test/a.test.ts'],
  }));

  assert.equal(session.tabs.code.currentNodeId, 'flow:src/a.ts');
  assert.equal(session.tabs.tests.currentNodeId, 'flow:test/a.test.ts');
});
