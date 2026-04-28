import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function repoRoot(): string {
  return path.resolve(__dirname, '..', '..', '..', '..', '..');
}

test('github PR read contract methods stay aligned with implementation surface', () => {
  const root = repoRoot();
  const contract = fs.readFileSync(
    path.join(root, 'specs', '001-pr-review-mcp-dependencies', 'contracts', 'github-pr-read.md'),
    'utf8',
  );
  const implementation = fs.readFileSync(
    path.join(root, 'packages', 'mcp', 'src', 'pr-review', 'github-pr-review-service.ts'),
    'utf8',
  );

  const expectedMethods = ['get', 'get_files', 'get_diff', 'get_reviews', 'get_review_comments'];
  for (const method of expectedMethods) {
    assert.ok(contract.includes(method), `Contract is missing read method ${method}`);
  }

  assert.ok(implementation.includes("'get_files'"));
  assert.ok(implementation.includes("'get_reviews'"));
  assert.ok(implementation.includes("'get_review_comments'"));
});

test('github PR review write contract methods stay aligned with implementation surface', () => {
  const root = repoRoot();
  const contract = fs.readFileSync(
    path.join(root, 'specs', '001-pr-review-mcp-dependencies', 'contracts', 'github-review-write.md'),
    'utf8',
  );
  const implementation = fs.readFileSync(
    path.join(root, 'packages', 'mcp', 'src', 'pr-review', 'github-pr-review-service.ts'),
    'utf8',
  );

  const expectedMethods = ['create', 'submit_pending', 'resolve_thread', 'unresolve_thread'];
  for (const method of expectedMethods) {
    assert.ok(contract.includes(method), `Contract is missing write method ${method}`);
  }

  assert.ok(implementation.includes("'create'"));
  assert.ok(implementation.includes("'submit_pending'"));
  assert.ok(implementation.includes("'resolve_thread'"));
  assert.ok(implementation.includes("'unresolve_thread'"));
});
