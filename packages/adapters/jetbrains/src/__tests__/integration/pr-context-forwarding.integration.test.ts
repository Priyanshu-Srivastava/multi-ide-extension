import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function repoRoot(): string {
  return path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
}

test('jetbrains bridge forwards pull_request_read tools/call requests', () => {
  const root = repoRoot();
  const source = fs.readFileSync(
    path.join(root, 'packages', 'adapters', 'jetbrains', 'src', 'index.ts'),
    'utf8',
  );

  assert.ok(source.includes('tools/call'));
  assert.ok(source.includes('pull_request_read'));
  assert.ok(source.includes('GITHUB_MCP_DOCKER_IMAGE'));
});

test('jetbrains sidecar entrypoint returns 401 when GitHub credentials are missing', () => {
  const root = repoRoot();
  const source = fs.readFileSync(
    path.join(root, 'packages', 'adapters', 'jetbrains', 'src', 'activate.ts'),
    'utf8',
  );

  assert.ok(source.includes('writeHead(401'));
  assert.ok(source.includes('GITHUB_PERSONAL_ACCESS_TOKEN'));
});
