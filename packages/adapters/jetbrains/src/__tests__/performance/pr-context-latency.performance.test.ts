import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function repoRoot(): string {
  return path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
}

test('jetbrains PR fetch latency budget is constrained to 5 seconds', () => {
  const root = repoRoot();
  const source = fs.readFileSync(
    path.join(root, 'packages', 'adapters', 'jetbrains', 'src', 'index.ts'),
    'utf8',
  );

  const match = source.match(/PR_FETCH_MAX_LATENCY_MS\s*=\s*([0-9_]+)/);
  assert.ok(match, 'PR_FETCH_MAX_LATENCY_MS constant is missing');
  const value = Number.parseInt(match[1].replace(/_/g, ''), 10);
  assert.ok(value <= 5000, `Expected PR fetch latency budget <= 5000ms, got ${value}`);
});
