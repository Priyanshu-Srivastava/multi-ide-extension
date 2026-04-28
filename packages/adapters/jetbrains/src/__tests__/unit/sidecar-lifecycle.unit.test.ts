import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function repoRoot(): string {
  return path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
}

test('jetbrains sidecar uses pinned GitHub MCP docker image', () => {
  const root = repoRoot();
  const source = fs.readFileSync(
    path.join(root, 'packages', 'adapters', 'jetbrains', 'src', 'index.ts'),
    'utf8',
  );

  assert.ok(source.includes("ghcr.io/github/github-mcp-server:v1.0.3"));
  assert.ok(source.includes("spawn('docker'"));
});

test('jetbrains sidecar enforces timeout and single restart policy', () => {
  const root = repoRoot();
  const source = fs.readFileSync(
    path.join(root, 'packages', 'adapters', 'jetbrains', 'src', 'index.ts'),
    'utf8',
  );

  assert.ok(source.includes('SIDECAR_CALL_TIMEOUT_MS = 30_000'));
  assert.ok(source.includes('SIDECAR_MAX_RESTARTS = 1'));
  assert.ok(source.includes('retryPendingAfterExit'));
});

test('jetbrains sidecar keeps parse-error handling in RPC entrypoint', () => {
  const root = repoRoot();
  const source = fs.readFileSync(
    path.join(root, 'packages', 'adapters', 'jetbrains', 'src', 'activate.ts'),
    'utf8',
  );

  assert.ok(source.includes('code: -32700'));
});
