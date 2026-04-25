import test from 'node:test';
import assert from 'node:assert/strict';
import { ANALYSIS_STAGES, AnalysisMethod } from '../../features/project-analyser/ipc-contract';

test('ipc contract exposes stable method names', () => {
  assert.deepEqual(AnalysisMethod, {
    Run: 'analysis.run',
    Progress: 'analysis.progress',
  });
});

test('ipc contract exposes the expected analysis stage order', () => {
  assert.deepEqual(ANALYSIS_STAGES, [
    'gathering',
    'architecture',
    'deployment',
    'flows',
    'code',
    'summary',
  ]);
});