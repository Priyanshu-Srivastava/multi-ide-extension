import type { AIAnalysisNote, ChangedFile, PrReviewAnalysisPort } from '@omni/core';

export interface HunkWithAnalysis {
  filePath: string;
  hunkId: string;
  analysis: AIAnalysisNote;
}

function normalizeAnalysis(hunkId: string, analysis: AIAnalysisNote): AIAnalysisNote {
  const qualityRisks = analysis.qualityRisks.length > 0 ? analysis.qualityRisks : ['No major quality risks detected.'];
  return {
    ...analysis,
    hunkId,
    qualityRisks,
    lowRisk: analysis.lowRisk || qualityRisks[0] === 'No major quality risks detected.',
  };
}

export async function analyzeChangedFileHunks(
  port: PrReviewAnalysisPort,
  file: ChangedFile
): Promise<HunkWithAnalysis[]> {
  const results: HunkWithAnalysis[] = [];

  for (const hunk of file.hunks) {
    const analysis = await port.analyzeDiffHunk(file.path, hunk.hunkId);
    results.push({
      filePath: file.path,
      hunkId: hunk.hunkId,
      analysis: normalizeAnalysis(hunk.hunkId, analysis),
    });
  }

  return results;
}
