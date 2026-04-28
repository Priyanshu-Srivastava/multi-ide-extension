import { buildHunkTrace, type ChangedFile, type DiffHunk } from '@omni/core';

export interface RenderLine {
  kind: 'added' | 'removed' | 'context';
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
  color: 'green' | 'red' | 'neutral';
}

export interface RenderHunk {
  hunkId: string;
  filePath: string;
  traceLineNumbers: number[];
  lines: RenderLine[];
}

export interface DiffRenderModel {
  filePath: string;
  renderable: boolean;
  reason?: string;
  hunks: RenderHunk[];
}

function renderColor(kind: RenderLine['kind']): RenderLine['color'] {
  if (kind === 'added') {
    return 'green';
  }
  if (kind === 'removed') {
    return 'red';
  }
  return 'neutral';
}

function toRenderHunk(hunk: DiffHunk): RenderHunk {
  const trace = buildHunkTrace(hunk);
  return {
    hunkId: hunk.hunkId,
    filePath: hunk.filePath,
    traceLineNumbers: trace.lineNumbers,
    lines: hunk.lines.map((line) => ({
      kind: line.kind,
      oldLineNumber: line.oldLineNumber,
      newLineNumber: line.newLineNumber,
      content: line.content,
      color: renderColor(line.kind),
    })),
  };
}

export function buildDiffRenderModel(file: ChangedFile): DiffRenderModel {
  if (file.hunks.length === 0) {
    return {
      filePath: file.path,
      renderable: false,
      reason: 'No renderable diff hunks available (binary, deleted-only, or unsupported).',
      hunks: [],
    };
  }

  return {
    filePath: file.path,
    renderable: true,
    hunks: file.hunks.map((hunk) => toRenderHunk(hunk)),
  };
}

export function hasTargetLine(
  file: ChangedFile,
  side: 'LEFT' | 'RIGHT',
  line: number
): boolean {
  return file.hunks.some((hunk) =>
    hunk.lines.some((entry) => (side === 'RIGHT' ? entry.newLineNumber : entry.oldLineNumber) === line)
  );
}
