import assert from 'node:assert/strict';
import test from 'node:test';
import { GitHubPrReviewService } from '../../pr-review';

test('submitLineComment routes writes to write tools and not readonly read tool', async () => {
  const invokedTools: string[] = [];

  const fakeRegistry = {
    async execute(toolId: string): Promise<{ success: boolean; data: unknown }> {
      invokedTools.push(toolId);
      if (toolId === 'github.pull_request_review_write') {
        return { success: true, data: { id: 'review-1' } };
      }
      if (toolId === 'github.add_comment_to_pending_review') {
        return { success: true, data: { id: 'comment-1' } };
      }
      return { success: true, data: [] };
    },
  };

  const service = new GitHubPrReviewService(fakeRegistry as never, {
    correlationIdFactory: () => 'corr-test',
  });

  await service.submitLineComment('owner/repo', 10, {
    draftId: 'draft-1',
    filePath: 'src/index.ts',
    line: 5,
    side: 'RIGHT',
    body: 'Looks good',
    updatedAtIso: new Date(0).toISOString(),
  });

  assert.ok(invokedTools.includes('github.pull_request_review_write'));
  assert.ok(invokedTools.includes('github.add_comment_to_pending_review'));
  assert.ok(!invokedTools.includes('github.pull_request_read'));
});

test('setThreadResolved validates required threadId input', async () => {
  const fakeRegistry = {
    async execute(): Promise<{ success: boolean; data: unknown }> {
      return { success: true, data: {} };
    },
  };

  const service = new GitHubPrReviewService(fakeRegistry as never);

  await assert.rejects(async () => {
    await service.setThreadResolved('owner/repo', 12, '', true);
  }, /threadId is required/);
});

test('submitLineComment preserves invalid line/path failures from write tools', async () => {
  const fakeRegistry = {
    async execute(toolId: string): Promise<{ success: boolean; data?: unknown; error?: string }> {
      if (toolId === 'github.pull_request_review_write') {
        return { success: true, data: { id: 'review-1' } };
      }
      if (toolId === 'github.add_comment_to_pending_review') {
        return { success: false, error: 'Invalid line/path mapping for changed file' };
      }
      return { success: true, data: {} };
    },
  };

  const service = new GitHubPrReviewService(fakeRegistry as never);

  await assert.rejects(
    async () => {
      await service.submitLineComment('owner/repo', 13, {
        draftId: 'draft-2',
        filePath: 'src/missing.ts',
        line: 999,
        side: 'RIGHT',
        body: 'broken mapping',
        updatedAtIso: new Date(0).toISOString(),
      });
    },
    /Invalid line\/path mapping/,
  );
});

test('review write roundtrip can be verified via follow-up get_review_comments read', async () => {
  const calls: Array<{ toolId: string }> = [];
  const fakeRegistry = {
    async execute(toolId: string): Promise<{ success: boolean; data?: unknown; error?: string }> {
      calls.push({ toolId });
      if (toolId === 'github.pull_request_review_write') {
        return { success: true, data: { id: 'review-2' } };
      }
      if (toolId === 'github.add_comment_to_pending_review') {
        return { success: true, data: { id: 'comment-2' } };
      }
      if (toolId === 'github.pull_request_read') {
        return {
          success: true,
          data: [{ id: 'comment-2', path: 'src/index.ts', line: 5, body: 'Looks good', resolved: false }],
        };
      }
      return { success: true, data: {} };
    },
  };

  const service = new GitHubPrReviewService(fakeRegistry as never);
  await service.submitLineComment('owner/repo', 14, {
    draftId: 'draft-3',
    filePath: 'src/index.ts',
    line: 5,
    side: 'RIGHT',
    body: 'Looks good',
    updatedAtIso: new Date(0).toISOString(),
  });

  const threads = await service.fetchReviewThreads('owner/repo', 14);
  assert.ok(threads.some((thread) => thread.body === 'Looks good'));
  assert.ok(calls.some((call) => call.toolId === 'github.pull_request_read'));
});

test('setThreadResolved is idempotent and state is reflected on subsequent fetch', async () => {
  let resolved = false;
  const fakeRegistry = {
    async execute(toolId: string): Promise<{ success: boolean; data?: unknown; error?: string }> {
      if (toolId === 'github.pull_request_review_write') {
        resolved = true;
        return { success: true, data: { ok: true } };
      }
      if (toolId === 'github.pull_request_read') {
        return {
          success: true,
          data: [{ id: 'thread-1', path: 'src/index.ts', line: 10, body: 'thread', resolved }],
        };
      }
      return { success: true, data: {} };
    },
  };

  const service = new GitHubPrReviewService(fakeRegistry as never);
  await service.setThreadResolved('owner/repo', 22, 'thread-1', true);
  await service.setThreadResolved('owner/repo', 22, 'thread-1', true);

  const threads = await service.fetchReviewThreads('owner/repo', 22);
  assert.equal(threads[0]?.resolved, true);
});
