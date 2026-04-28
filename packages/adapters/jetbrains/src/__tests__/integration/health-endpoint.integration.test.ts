import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function repoRoot(): string {
  return path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
}

test('jetbrains activate exposes health endpoint with registered tools', () => {
  const root = repoRoot();
  const source = fs.readFileSync(
    path.join(root, 'packages', 'adapters', 'jetbrains', 'src', 'activate.ts'),
    'utf8',
  );

  assert.ok(source.includes("req.url === '/health'"));
  assert.ok(source.includes('registry.listTools()'));
});
