import type {
  ChangedFile,
  DiffHunk,
  DiffLine,
  FlowNode,
  PostedReviewComment,
  PrReviewReadPort,
  PrReviewWritePort,
  PullRequestContext,
  ReviewCommentDraft,
} from '@omni/core';
import { MCPRegistry } from '../registry';

const READ_TOOL_ID = 'github.pull_request_read';
const LIST_TOOL_ID = 'github.list_pull_requests';
const REVIEW_WRITE_TOOL_ID = 'github.pull_request_review_write';
const ADD_COMMENT_TOOL_ID = 'github.add_comment_to_pending_review';

const TEST_FILE_PATTERN = /(^|\/)(test|tests|__tests__)\/|\.(test|spec)\.[a-z0-9]+$/i;

type RecordValue = Record<string, unknown>;

export interface GitHubPrReviewServiceOptions {
  correlationIdFactory?: () => string;
}

export interface ReviewThread {
  threadId: string;
  resolved: boolean;
  filePath?: string;
  line?: number;
  body?: string;
}

export interface PullRequestReview {
  id: string;
  state?: string;
  body?: string;
  author?: string;
}

export function parseRepository(repository: string): { owner: string; repo: string } {
  const [owner, repo] = repository.split('/');
  if (!owner || !repo) {
    throw new Error(`Invalid repository format: ${repository}. Expected "owner/repo".`);
  }
  return { owner, repo };
}

function asRecord(value: unknown): RecordValue | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as RecordValue;
  }
  return undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function toCorrelationId(factory: (() => string) | undefined): string {
  if (factory) {
    return factory();
  }
  return `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

function createDiffLine(kind: DiffLine['kind'], content: string, oldLineNumber?: number, newLineNumber?: number): DiffLine {
  return {
    kind,
    content,
    oldLineNumber,
    newLineNumber,
  };
}

function parseHunkHeader(line: string): { oldStart: number; newStart: number } | undefined {
  const match = line.match(/^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
  if (!match) {
    return undefined;
  }

  const oldStart = Number.parseInt(match[1], 10);
  const newStart = Number.parseInt(match[2], 10);
  if (!Number.isFinite(oldStart) || !Number.isFinite(newStart)) {
    return undefined;
  }

  return { oldStart, newStart };
}

export function parsePatchToHunks(filePath: string, patch: string | null): DiffHunk[] {
  if (!patch) {
    return [];
  }

  const lines = patch.split(/\r?\n/);
  const hunks: DiffHunk[] = [];
  let current: DiffHunk | undefined;
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    const header = parseHunkHeader(line);
    if (header) {
      current = {
        hunkId: `${filePath}#${hunks.length + 1}`,
        filePath,
        oldStart: header.oldStart,
        newStart: header.newStart,
        lines: [],
      };
      hunks.push(current);
      oldLine = header.oldStart;
      newLine = header.newStart;
      continue;
    }

    if (!current) {
      continue;
    }

    if (line.startsWith('+')) {
      current.lines.push(createDiffLine('added', line, undefined, newLine));
      newLine += 1;
      continue;
    }
    if (line.startsWith('-')) {
      current.lines.push(createDiffLine('removed', line, oldLine, undefined));
      oldLine += 1;
      continue;
    }

    current.lines.push(createDiffLine('context', line, oldLine, newLine));
    oldLine += 1;
    newLine += 1;
  }

  return hunks;
}

export function parseChangedFilesPayload(payload: unknown): ChangedFile[] {
  const files = asArray(payload);
  return files.map((entry) => {
    const file = asRecord(entry) ?? {};
    const path = asString(file.filename) ?? asString(file.path) ?? 'unknown-file';
    const patchValue = file.patch;
    const patch = typeof patchValue === 'string' ? patchValue : null;

    return {
      path,
      classification: TEST_FILE_PATTERN.test(path) ? 'test' : 'code',
      hunks: parsePatchToHunks(path, patch),
    } satisfies ChangedFile;
  });
}

export function projectFlowNodes(changedFilePaths: string[]): FlowNode[] {
  const normalized = changedFilePaths.filter((path) => path.length > 0);
  return normalized.map((filePath, index) => {
    const next = normalized[index + 1];
    return {
      nodeId: `flow:${filePath}`,
      filePath,
      childNodeIds: next ? [`flow:${next}`] : [],
      confidence: 1,
    } satisfies FlowNode;
  });
}

export class GitHubPrReviewService implements PrReviewReadPort, PrReviewWritePort {
  private readonly correlationIdFactory: () => string;

  constructor(
    private readonly registry: MCPRegistry,
    options: GitHubPrReviewServiceOptions = {},
  ) {
    this.correlationIdFactory = options.correlationIdFactory ?? (() => toCorrelationId(undefined));
  }

  async fetchPullRequestContext(repository: string, pullRequestNumber: number): Promise<PullRequestContext> {
    const payload = await this.callRead(repository, 'get', { pullNumber: pullRequestNumber });
    const record = asRecord(payload) ?? {};

    return {
      repository,
      pullRequestNumber,
      title: asString(record.title),
      baseRef: asString(record.baseRefName) ?? asString(record.baseRef),
      headRef: asString(record.headRefName) ?? asString(record.headRef),
      snapshotSha: asString(record.headRefOid) ?? asString(record.headSha),
    };
  }

  async fetchChangedFiles(repository: string, pullRequestNumber: number): Promise<ChangedFile[]> {
    const pages = await this.readPaginated(repository, 'get_files', pullRequestNumber);
    const flattened = pages.flatMap((page) => asArray(page));
    return parseChangedFilesPayload(flattened);
  }

  async fetchDiff(repository: string, pullRequestNumber: number): Promise<string> {
    const payload = await this.callRead(repository, 'get_diff', { pullNumber: pullRequestNumber });
    if (typeof payload === 'string') {
      return payload;
    }
    return JSON.stringify(payload);
  }

  async fetchFlowNodes(_repository: string, changedFilePaths: string[]): Promise<FlowNode[]> {
    return projectFlowNodes(changedFilePaths);
  }

  async fetchReviews(repository: string, pullRequestNumber: number): Promise<PullRequestReview[]> {
    const payload = await this.callRead(repository, 'get_reviews', { pullNumber: pullRequestNumber });
    const items = asArray(payload);
    return items.map((entry) => {
      const review = asRecord(entry) ?? {};
      return {
        id: String(review.id ?? review.node_id ?? `review-${Math.random()}`),
        state: asString(review.state),
        body: asString(review.body),
        author: asString(asRecord(review.user)?.login),
      } satisfies PullRequestReview;
    });
  }

  async fetchReviewThreads(repository: string, pullRequestNumber: number): Promise<ReviewThread[]> {
    const payload = await this.callRead(repository, 'get_review_comments', { pullNumber: pullRequestNumber });
    const comments = asArray(payload);
    return comments.map((entry) => {
      const comment = asRecord(entry) ?? {};
      return {
        threadId: String(comment.id ?? comment.node_id ?? `thread-${Math.random()}`),
        resolved: asBoolean(comment.resolved) ?? false,
        filePath: asString(comment.path),
        line: asNumber(comment.line),
        body: asString(comment.body),
      } satisfies ReviewThread;
    });
  }

  async setThreadResolved(
    repository: string,
    pullRequestNumber: number,
    threadId: string,
    resolved: boolean,
  ): Promise<void> {
    if (!threadId || threadId.trim().length === 0) {
      throw new Error('threadId is required for thread resolve/unresolve operations.');
    }

    await this.callWrite(repository, resolved ? 'resolve_thread' : 'unresolve_thread', {
      pullNumber: pullRequestNumber,
      threadId,
    });
  }

  async submitLineComment(
    repository: string,
    pullRequestNumber: number,
    draft: ReviewCommentDraft,
  ): Promise<PostedReviewComment> {
    const createResult = await this.callWrite(repository, 'create', {
      pullNumber: pullRequestNumber,
      event: 'COMMENT',
    });

    const createRecord = asRecord(createResult) ?? {};
    const pendingReviewId = asString(createRecord.id) ?? asString(createRecord.review_id);

    await this.callRaw(ADD_COMMENT_TOOL_ID, repository, {
      pullNumber: pullRequestNumber,
      reviewId: pendingReviewId,
      path: draft.filePath,
      line: draft.line,
      side: draft.side,
      body: draft.body,
    });

    await this.callWrite(repository, 'submit_pending', {
      pullNumber: pullRequestNumber,
      event: 'COMMENT',
      reviewId: pendingReviewId,
    });

    return {
      commentId: draft.draftId,
      filePath: draft.filePath,
      line: draft.line,
      side: draft.side,
      body: draft.body,
    };
  }

  private async readPaginated(
    repository: string,
    method: string,
    pullRequestNumber: number,
  ): Promise<unknown[]> {
    const pages: unknown[] = [];
    let page = 1;

    let hasNext = true;
    while (hasNext) {
      const payload = await this.callRead(repository, method, { pullNumber: pullRequestNumber, page });
      pages.push(payload);

      const items = asArray(payload);
      if (items.length === 0) {
        hasNext = false;
        break;
      }
      page += 1;
      if (page > 20) {
        hasNext = false;
        break;
      }
    }

    return pages;
  }

  private async callRead(repository: string, method: string, args: RecordValue): Promise<unknown> {
    return this.callRaw(READ_TOOL_ID, repository, { method, ...args });
  }

  private async callWrite(repository: string, method: string, args: RecordValue): Promise<unknown> {
    return this.callRaw(REVIEW_WRITE_TOOL_ID, repository, { method, ...args });
  }

  private async callRaw(toolId: string, repository: string, args: RecordValue): Promise<unknown> {
    const { owner, repo } = parseRepository(repository);
    const result = await this.registry.execute(toolId, {
      method: 'tools/call',
      correlationId: this.correlationIdFactory(),
      params: {
        name: toolId.replace('github.', ''),
        arguments: {
          owner,
          repo,
          ...args,
        },
      },
    });

    if (!result.success) {
      throw new Error(result.error ?? `GitHub MCP call failed for ${toolId}.`);
    }

    return result.data;
  }

  async listPullRequests(repository: string): Promise<unknown> {
    return this.callRaw(LIST_TOOL_ID, repository, {});
  }
}
