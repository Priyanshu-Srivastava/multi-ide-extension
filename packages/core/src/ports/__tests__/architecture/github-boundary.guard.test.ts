import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const FORBIDDEN_PATTERNS: RegExp[] = [/@octokit\//, /api\.github\.com/, /github\.com\/graphql/];
const ALLOWED_PREFIX = path.normalize(path.join('packages', 'mcp', 'src'));

function walkTsFiles(dir: string, out: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'build', '.turbo', '__tests__'].includes(entry.name)) {
        continue;
      }
      walkTsFiles(full, out);
      continue;
    }

    if (full.endsWith('.ts') || full.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

test('direct GitHub API usage stays inside global MCP adapter paths', () => {
  const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
  const packageRoot = path.join(repoRoot, 'packages');
  const files = walkTsFiles(packageRoot);

  const violations: string[] = [];
  for (const filePath of files) {
    const relative = path.relative(repoRoot, filePath);
    const normalized = path.normalize(relative);

    if (normalized.startsWith(ALLOWED_PREFIX)) {
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(content)) {
        violations.push(`${relative}: ${pattern}`);
      }
    }
  }

  assert.equal(
    violations.length,
    0,
    `Found direct GitHub API usage outside global MCP adapters:\n${violations.join('\n')}`,
  );
});
