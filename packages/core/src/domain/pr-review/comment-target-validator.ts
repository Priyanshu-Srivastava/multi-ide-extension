import type { ChangedFile, ReviewCommentDraft } from '../../types/pr-review-types';

export function validateCommentTarget(draft: ReviewCommentDraft, changedFiles: ChangedFile[]): boolean {
  const file = changedFiles.find((candidate) => candidate.path === draft.filePath);
  if (!file) {
    return false;
  }

  return file.hunks.some((hunk) =>
    hunk.lines.some((line) =>
      (draft.side === 'RIGHT' ? line.newLineNumber : line.oldLineNumber) === draft.line
    )
  );
}
