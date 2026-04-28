import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function repoRoot(): string {
  return path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
}

test('vscode adapter preserves OAuth primary and PAT fallback auth path', () => {
  const root = repoRoot();
  const source = fs.readFileSync(
    path.join(root, 'packages', 'adapters', 'vscode', 'src', 'activate.ts'),
    'utf8',
  );

  assert.ok(source.includes("vscode.authentication.getSession('github', ['repo']"));
  assert.ok(source.includes('GITHUB_PERSONAL_ACCESS_TOKEN'));
  assert.ok(source.includes('GitHub connection required'));
});
