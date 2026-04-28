import assert from 'node:assert/strict';
import test from 'node:test';
import { GitHubPrReviewService } from '../../pr-review';

test('fetchChangedFiles handles pagination and empty final page', async () => {
  const payloads: unknown[] = [
    [{ filename: 'src/a.ts', patch: null }],
    [{ filename: 'src/b.ts', patch: null }],
    [],
  ];

  const fakeRegistry = {
    async execute(): Promise<{ success: boolean; data: unknown }> {
      return { success: true, data: payloads.shift() ?? [] };
    },
  };

  const service = new GitHubPrReviewService(fakeRegistry as never);
  const files = await service.fetchChangedFiles('owner/repo', 22);

  assert.equal(files.length, 2);
  assert.equal(files[0].path, 'src/a.ts');
  assert.equal(files[1].path, 'src/b.ts');
});
