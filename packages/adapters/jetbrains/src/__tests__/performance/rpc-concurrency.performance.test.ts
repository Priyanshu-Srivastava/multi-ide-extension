import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function repoRoot(): string {
  return path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
}

test('jetbrains bridge keeps pending-request queue required for 10-way parallel RPC calls', () => {
  const root = repoRoot();
  const source = fs.readFileSync(
    path.join(root, 'packages', 'adapters', 'jetbrains', 'src', 'index.ts'),
    'utf8',
  );

  assert.ok(source.includes('pendingById = new Map'));
  assert.ok(source.includes('dispatch(request: SidecarRequest)'));
  assert.ok(source.includes('retryPendingAfterExit'));
});
