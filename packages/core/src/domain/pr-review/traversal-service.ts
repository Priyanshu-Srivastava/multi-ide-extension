import type { FlowNode, TraversalPosition, TraversalState } from '../../types/pr-review-types';

type NodeMap = Record<string, FlowNode>;

function buildNodeMap(nodes: FlowNode[]): NodeMap {
  return nodes.reduce<NodeMap>((acc, node) => {
    acc[node.nodeId] = node;
    return acc;
  }, {});
}

function orderedChildren(nodeMap: NodeMap, nodeId?: string): string[] {
  if (!nodeId) {
    return [];
  }

  const node = nodeMap[nodeId];
  if (!node) {
    return [];
  }

  return [...node.childNodeIds].sort((a, b) => {
    const aPath = nodeMap[a]?.filePath ?? a;
    const bPath = nodeMap[b]?.filePath ?? b;
    return aPath.localeCompare(bPath);
  });
}

export function initializeTraversal(rootNodeId: string, tab: TraversalState['tab']): TraversalState {
  return {
    tab,
    rootNodeId,
    currentNodeId: rootNodeId,
    visitedNodeIds: [rootNodeId],
    backtrackStack: [rootNodeId],
  };
}

export function nextTraversalPosition(state: TraversalState, nodes: FlowNode[]): TraversalPosition {
  const nodeMap = buildNodeMap(nodes);
  const visited = new Set(state.visitedNodeIds);
  const stack = [...state.backtrackStack];

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const children = orderedChildren(nodeMap, current);
    const nextChild = children.find((childId) => !visited.has(childId));

    if (nextChild) {
      visited.add(nextChild);
      stack.push(nextChild);
      return { currentNodeId: nextChild, completed: false };
    }

    stack.pop();
  }

  return { currentNodeId: state.currentNodeId, completed: true };
}

export function applyTraversalAdvance(state: TraversalState, next: TraversalPosition): TraversalState {
  if (next.completed || !next.currentNodeId) {
    return state;
  }

  const visitedSet = new Set(state.visitedNodeIds);
  visitedSet.add(next.currentNodeId);

  return {
    ...state,
    currentNodeId: next.currentNodeId,
    visitedNodeIds: [...visitedSet],
    backtrackStack: [...state.backtrackStack, next.currentNodeId],
  };
}
