import type { DiffHunk } from '../../types/pr-review-types';

export interface HunkTrace {
  hunkId: string;
  filePath: string;
  lineNumbers: number[];
}

export function buildHunkTrace(hunk: DiffHunk): HunkTrace {
  const lineNumbers = hunk.lines
    .flatMap((line) => [line.newLineNumber ?? -1, line.oldLineNumber ?? -1])
    .filter((lineNo) => lineNo > 0);

  return {
    hunkId: hunk.hunkId,
    filePath: hunk.filePath,
    lineNumbers,
  };
}
