import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function repoRoot(): string {
  return path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
}

test('cursor adapter delegates activation to vscode adapter', () => {
  const root = repoRoot();
  const cursorActivate = fs.readFileSync(
    path.join(root, 'packages', 'adapters', 'cursor', 'src', 'activate.ts'),
    'utf8',
  );

  assert.match(
    cursorActivate,
    /export\s*\{\s*activate\s*,\s*deactivate\s*\}\s*from\s*'@omni\/adapters-vscode'/,
  );
});

test('vscode adapter configures readonly GitHub read transport', () => {
  const root = repoRoot();
  const vscodeActivate = fs.readFileSync(
    path.join(root, 'packages', 'adapters', 'vscode', 'src', 'activate.ts'),
    'utf8',
  );

  assert.ok(vscodeActivate.includes("'X-MCP-Readonly'"));
  assert.ok(vscodeActivate.includes('github.pull_request_read'));
  assert.ok(vscodeActivate.includes('github.list_pull_requests'));
});
