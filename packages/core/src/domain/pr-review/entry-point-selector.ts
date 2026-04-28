import type { EntryPointSelection, FlowNode } from '../../types/pr-review-types';

export function selectEntryPoint(nodes: FlowNode[], manualOverrideNodeId?: string): EntryPointSelection {
  if (manualOverrideNodeId) {
    const match = nodes.find((node) => node.nodeId === manualOverrideNodeId);
    if (match) {
      return { nodeId: match.nodeId, reason: 'manual-override' };
    }
  }

  if (nodes.length === 0) {
    throw new Error('Cannot select entry point from an empty node list.');
  }

  const highest = [...nodes].sort((a, b) => {
    const confidenceDelta = (b.confidence ?? 0) - (a.confidence ?? 0);
    if (confidenceDelta !== 0) {
      return confidenceDelta;
    }

    return a.filePath.localeCompare(b.filePath);
  });

  const [best, second] = highest;
  if (second && (best.confidence ?? 0) === (second.confidence ?? 0)) {
    return { nodeId: best.nodeId, reason: 'lexical-tie-break' };
  }

  return { nodeId: best.nodeId, reason: 'highest-confidence' };
}
