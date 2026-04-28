import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeChangedFileHunks } from '../hunk-analysis-service';
import type { ChangedFile, PrReviewAnalysisPort } from '@omni/core';

const changedFile: ChangedFile = {
  path: 'src/index.ts',
  classification: 'code',
  hunks: [
    {
      hunkId: 'hunk-1',
      filePath: 'src/index.ts',
      oldStart: 1,
      newStart: 1,
      lines: [{ kind: 'added', content: '+const x = 1;', newLineNumber: 1 }],
    },
  ],
};

test('analyzeChangedFileHunks enforces explicit low-risk analysis text when risks are empty', async () => {
  const port: PrReviewAnalysisPort = {
    async analyzeDiffHunk() {
      return {
        hunkId: 'wrong-id',
        intentSummary: 'Adds a constant',
        downstreamImpact: 'Low impact',
        qualityRisks: [],
        lowRisk: false,
        confidence: 0.9,
      };
    },
  };

  const results = await analyzeChangedFileHunks(port, changedFile);
  assert.equal(results.length, 1);
  assert.equal(results[0].hunkId, 'hunk-1');
  assert.equal(results[0].analysis.lowRisk, true);
  assert.deepEqual(results[0].analysis.qualityRisks, ['No major quality risks detected.']);
});
