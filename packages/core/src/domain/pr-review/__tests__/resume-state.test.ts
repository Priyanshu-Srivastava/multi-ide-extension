import assert from 'node:assert/strict';
import test from 'node:test';
import { resumeTraversalState } from '../traversal-state';

test('resumeTraversalState fills empty state from fallback node', () => {
  const resumed = resumeTraversalState(
    {
      tab: 'code',
      visitedNodeIds: [],
      backtrackStack: [],
    },
    'flow:src/a.ts',
  );

  assert.equal(resumed.rootNodeId, 'flow:src/a.ts');
  assert.equal(resumed.currentNodeId, 'flow:src/a.ts');
  assert.deepEqual(resumed.visitedNodeIds, ['flow:src/a.ts']);
  assert.deepEqual(resumed.backtrackStack, ['flow:src/a.ts']);
});

test('resumeTraversalState preserves existing current node and stack', () => {
  const resumed = resumeTraversalState(
    {
      tab: 'tests',
      rootNodeId: 'flow:test/a.test.ts',
      currentNodeId: 'flow:test/b.test.ts',
      visitedNodeIds: ['flow:test/a.test.ts'],
      backtrackStack: ['flow:test/a.test.ts'],
    },
    'flow:test/a.test.ts',
  );

  assert.equal(resumed.currentNodeId, 'flow:test/b.test.ts');
  assert.deepEqual(resumed.visitedNodeIds, ['flow:test/a.test.ts', 'flow:test/b.test.ts']);
  assert.deepEqual(resumed.backtrackStack, ['flow:test/a.test.ts', 'flow:test/b.test.ts']);
});
