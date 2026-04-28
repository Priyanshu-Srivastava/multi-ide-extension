import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const REQUIRED_PORT_SNIPPETS = [
  'export interface PrReviewReadPort',
  'fetchPullRequestContext(repository: string, pullRequestNumber: number)',
  'fetchChangedFiles(repository: string, pullRequestNumber: number)',
  'fetchFlowNodes(repository: string, changedFilePaths: string[])',
  'export interface PrReviewWritePort',
  'submitLineComment(repository: string, pullRequestNumber: number, draft: ReviewCommentDraft)',
];

const REQUIRED_CONSUMER_SPECS = [
  path.join('teams', 'team-c', 'specs', '001-pr-review-visualizer-analyzer', 'spec.md'),
  path.join('teams', 'team-b', 'specs', '001-github-pr-review-comments', 'spec.md'),
];

test('pr-review port contract surface remains present for team consumers', () => {
  const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
  const portPath = path.join(repoRoot, 'packages', 'core', 'src', 'ports', 'pr-review-ports.ts');
  const source = fs.readFileSync(portPath, 'utf8');

  for (const snippet of REQUIRED_PORT_SNIPPETS) {
    assert.ok(source.includes(snippet), `Missing expected port contract snippet: ${snippet}`);
  }
});

test('consumer spec references exist for compatibility checks', () => {
  const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');

  for (const relativePath of REQUIRED_CONSUMER_SPECS) {
    const fullPath = path.join(repoRoot, relativePath);
    assert.ok(fs.existsSync(fullPath), `Expected consumer spec file is missing: ${relativePath}`);
  }
});
