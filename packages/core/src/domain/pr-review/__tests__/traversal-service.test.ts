import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTraversalAdvance, initializeTraversal, nextTraversalPosition } from '../traversal-service';
import type { FlowNode } from '../../../types/pr-review-types';

const nodes: FlowNode[] = [
  { nodeId: 'A', filePath: 'src/a.ts', childNodeIds: ['B', 'C'] },
  { nodeId: 'B', filePath: 'src/b.ts', childNodeIds: ['D'] },
  { nodeId: 'C', filePath: 'src/c.ts', childNodeIds: [] },
  { nodeId: 'D', filePath: 'src/d.ts', childNodeIds: [] },
];

test('traversal is deterministic depth-first with backtracking', () => {
  let state = initializeTraversal('A', 'code');

  const visitOrder: string[] = [state.currentNodeId as string];
  for (let i = 0; i < 4; i += 1) {
    const next = nextTraversalPosition(state, nodes);
    if (next.completed) {
      break;
    }
    state = applyTraversalAdvance(state, next);
    visitOrder.push(state.currentNodeId as string);
  }

  assert.deepEqual(visitOrder, ['A', 'B', 'D', 'C']);
});

test('traversal completes when no unvisited children remain', () => {
  const state = {
    tab: 'code' as const,
    rootNodeId: 'A',
    currentNodeId: 'C',
    visitedNodeIds: ['A', 'B', 'C', 'D'],
    backtrackStack: ['A', 'C'],
  };

  const next = nextTraversalPosition(state, nodes);
  assert.equal(next.completed, true);
  assert.equal(next.currentNodeId, 'C');
});
