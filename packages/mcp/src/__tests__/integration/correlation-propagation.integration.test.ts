import assert from 'node:assert/strict';
import test from 'node:test';
import { ExternalMCPToolAdapter, MCPRegistry } from '../../registry';

test('correlationId propagates adapter -> registry -> transport response', async () => {
  const invocations: Array<{ correlationId?: string }> = [];

  const registry = new MCPRegistry(
    { version: '1', tools: [{ toolId: 'github.pull_request_read', enabled: true }] },
    {
      onInvocation: (event) => {
        invocations.push({ correlationId: event.correlationId });
      },
    },
  );

  registry.register(
    new ExternalMCPToolAdapter({
      toolId: 'github.pull_request_read',
      displayName: 'GitHub PR Read',
      teamId: 'controller-pod',
      transport: async (request) => ({
        jsonrpc: '2.0',
        id: request.id,
        correlationId: request.correlationId,
        status: 'success',
        result: { content: [{ type: 'text', text: '{"ok":true}' }] },
      }),
    }),
  );

  const result = await registry.execute('github.pull_request_read', {
    method: 'tools/call',
    correlationId: 'corr-123',
    params: { name: 'pull_request_read', arguments: { method: 'get', owner: 'a', repo: 'b', pullNumber: 1 } },
  });

  assert.equal(result.success, true);
  assert.equal(result.correlationId, 'corr-123');
  assert.ok(invocations.some((entry) => entry.correlationId === 'corr-123'));
});
