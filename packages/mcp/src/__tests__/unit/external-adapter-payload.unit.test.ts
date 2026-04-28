import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMixedContentPayload } from '../../registry';

test('parseMixedContentPayload parses JSON text payloads', () => {
  const payload = parseMixedContentPayload({
    content: [{ type: 'text', text: '{"ok":true,"count":2}' }],
  });

  assert.deepEqual(payload, { ok: true, count: 2 });
});

test('parseMixedContentPayload preserves raw diff text payloads', () => {
  const diff = 'diff --git a/file.ts b/file.ts\n@@ -1 +1 @@\n-console.log(1)\n+console.log(2)';
  const payload = parseMixedContentPayload({
    content: [{ type: 'text', text: diff }],
  });

  assert.equal(payload, diff);
});

test('parseMixedContentPayload uses structuredContent when present', () => {
  const payload = parseMixedContentPayload({
    structuredContent: { id: 1, name: 'pr' },
    content: [{ type: 'text', text: '{"ignored":true}' }],
  });

  assert.deepEqual(payload, { id: 1, name: 'pr' });
});
