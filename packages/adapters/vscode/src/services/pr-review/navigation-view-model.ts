import type { FlowNode, TraversalState } from '@omni/core';

export interface NavigationViewModel {
  currentNodeId?: string;
  currentFilePath?: string;
  parentNodeId?: string;
  parentFilePath?: string;
  remainingBranchNodeIds: string[];
  remainingBranchFilePaths: string[];
}

function toNodeMap(nodes: FlowNode[]): Record<string, FlowNode> {
  return nodes.reduce<Record<string, FlowNode>>((acc, node) => {
    acc[node.nodeId] = node;
    return acc;
  }, {});
}

export function buildNavigationViewModel(
  state: TraversalState,
  nodes: FlowNode[]
): NavigationViewModel {
  const nodeMap = toNodeMap(nodes);
  const currentNode = state.currentNodeId ? nodeMap[state.currentNodeId] : undefined;

  const stack = state.backtrackStack;
  const parentNodeId = stack.length >= 2 ? stack[stack.length - 2] : undefined;
  const parentNode = parentNodeId ? nodeMap[parentNodeId] : undefined;

  const visited = new Set(state.visitedNodeIds);
  const remainingBranchNodeIds = stack.flatMap((nodeId) => {
    const node = nodeMap[nodeId];
    if (!node) {
      return [];
    }
    return node.childNodeIds
      .filter((childId) => !visited.has(childId))
      .sort((a, b) => {
        const aPath = nodeMap[a]?.filePath ?? a;
        const bPath = nodeMap[b]?.filePath ?? b;
        return aPath.localeCompare(bPath);
      });
  });

  return {
    currentNodeId: state.currentNodeId,
    currentFilePath: currentNode?.filePath,
    parentNodeId,
    parentFilePath: parentNode?.filePath,
    remainingBranchNodeIds,
    remainingBranchFilePaths: remainingBranchNodeIds
      .map((nodeId) => nodeMap[nodeId]?.filePath)
      .filter((path): path is string => typeof path === 'string'),
  };
}
