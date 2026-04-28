import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { SidecarRequest, SidecarResponse, SidecarTransport } from '@omni/core';

export const GITHUB_MCP_DOCKER_IMAGE = 'ghcr.io/github/github-mcp-server:v1.0.3';
export const SIDECAR_CALL_TIMEOUT_MS = 30_000;
export const SIDECAR_MAX_RESTARTS = 1;
export const PR_FETCH_MAX_LATENCY_MS = 5_000;

const GITHUB_TOOL_NAMES = new Set([
  'pull_request_read',
  'list_pull_requests',
  'pull_request_review_write',
  'add_comment_to_pending_review',
]);

type PendingRequest = {
  request: SidecarRequest;
  retries: number;
  resolve: (response: SidecarResponse) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

type RequestBody = SidecarRequest & {
  params?: {
    name?: unknown;
    [key: string]: unknown;
  };
};

export function buildDockerArgs(token: string): string[] {
  return [
    'run',
    '-i',
    '--rm',
    '-e',
    `GITHUB_PERSONAL_ACCESS_TOKEN=${token}`,
    GITHUB_MCP_DOCKER_IMAGE,
  ];
}

export function isGitHubToolCall(request: SidecarRequest): boolean {
  if (request.method !== 'tools/call') {
    return false;
  }
  const body = request as RequestBody;
  const name = body.params?.name;
  return typeof name === 'string' && GITHUB_TOOL_NAMES.has(name);
}

class DockerSidecarProcess {
  private process: ChildProcessWithoutNullStreams | undefined;
  private buffer = '';
  private restartCount = 0;
  private readonly pendingById = new Map<string | number, PendingRequest>();

  async send(request: SidecarRequest): Promise<SidecarResponse> {
    if (isGitHubToolCall(request) && !this.getToken()) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        status: 'failure',
        error: {
          code: 401,
          message: 'GitHub connection required. Set GITHUB_PERSONAL_ACCESS_TOKEN before using GitHub MCP tools.',
        },
      };
    }

    await this.ensureStarted();
    return this.dispatch(request);
  }

  private getToken(): string | undefined {
    const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    if (!token) {
      return undefined;
    }
    const trimmed = token.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private async ensureStarted(): Promise<void> {
    if (this.process && !this.process.killed) {
      return;
    }

    const token = this.getToken() ?? '';
    this.process = spawn('docker', buildDockerArgs(token), {
      stdio: 'pipe',
    });

    this.process.stdout.setEncoding('utf8');
    this.process.stdout.on('data', (chunk: string) => {
      this.buffer += chunk;
      this.consumeBuffer();
    });

    this.process.stderr.setEncoding('utf8');
    this.process.stderr.on('data', (chunk: string) => {
      const message = chunk.trim();
      if (message.length > 0) {
        console.error(`[jetbrains-sidecar] ${message}`);
      }
    });

    this.process.on('exit', () => {
      this.process = undefined;
      this.retryPendingAfterExit();
    });
  }

  private dispatch(request: SidecarRequest): Promise<SidecarResponse> {
    return new Promise<SidecarResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingById.delete(request.id);
        reject(new Error(`JetBrains sidecar call timed out after ${SIDECAR_CALL_TIMEOUT_MS}ms`));
      }, SIDECAR_CALL_TIMEOUT_MS);

      this.pendingById.set(request.id, {
        request,
        retries: 0,
        resolve,
        reject,
        timer,
      });

      const payload = `${JSON.stringify(request)}\n`;
      this.process?.stdin.write(payload, 'utf8', (err) => {
        if (err) {
          clearTimeout(timer);
          this.pendingById.delete(request.id);
          reject(err);
        }
      });
    });
  }

  private consumeBuffer(): void {
    let newlineIndex = this.buffer.indexOf('\n');
    while (newlineIndex >= 0) {

      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (!line) {
        continue;
      }

      let response: SidecarResponse;
      try {
        response = JSON.parse(line) as SidecarResponse;
      } catch {
        continue;
      }

      const pending = this.pendingById.get(response.id);
      if (!pending) {
        continue;
      }

      clearTimeout(pending.timer);
      this.pendingById.delete(response.id);
      pending.resolve({
        jsonrpc: '2.0',
        id: response.id,
        status: response.error ? 'failure' : response.status ?? 'success',
        correlationId: response.correlationId,
        retryAfter: response.retryAfter,
        result: response.result,
        error: response.error,
      });

      newlineIndex = this.buffer.indexOf('\n');
    }
  }

  private retryPendingAfterExit(): void {
    const entries = Array.from(this.pendingById.values());
    if (entries.length === 0) {
      return;
    }

    if (this.restartCount >= SIDECAR_MAX_RESTARTS) {
      for (const pending of entries) {
        clearTimeout(pending.timer);
        this.pendingById.delete(pending.request.id);
        pending.reject(new Error('JetBrains sidecar exited and restart limit was reached.'));
      }
      return;
    }

    this.restartCount += 1;
    for (const pending of entries) {
      pending.retries += 1;
    }

    void this.ensureStarted().then(() => {
      for (const pending of entries) {
        const current = this.pendingById.get(pending.request.id);
        if (!current) {
          continue;
        }

        const payload = `${JSON.stringify(current.request)}\n`;
        this.process?.stdin.write(payload, 'utf8', (err) => {
          if (err) {
            clearTimeout(current.timer);
            this.pendingById.delete(current.request.id);
            current.reject(err);
          }
        });
      }
    }).catch((error) => {
      for (const pending of entries) {
        clearTimeout(pending.timer);
        this.pendingById.delete(pending.request.id);
        pending.reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }
}

const sidecarProcess = new DockerSidecarProcess();

export const JetBrainsSidecarBridge: SidecarTransport = async (
  request: SidecarRequest,
): Promise<SidecarResponse> => {
  const startedAt = Date.now();
  const toolName = (request as RequestBody).params?.name;

  if (request.method !== 'tools/call' && request.method !== 'tools/list') {
    return {
      jsonrpc: '2.0',
      id: request.id,
      status: 'failure',
      error: {
        code: -32601,
        message: `Unsupported RPC method: ${request.method}`,
      },
    };
  }

  try {
    const response = await sidecarProcess.send(request);
    console.log(
      JSON.stringify({
        toolId: typeof toolName === 'string' ? toolName : request.method,
        ide: 'jetbrains',
        operation: request.method,
        status: response.error ? 'failure' : response.status ?? 'success',
        durationMs: Date.now() - startedAt,
        errorCode: response.error?.code,
        correlationId: request.correlationId,
      }),
    );
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const timeout = message.toLowerCase().includes('timed out');
    console.log(
      JSON.stringify({
        toolId: typeof toolName === 'string' ? toolName : request.method,
        ide: 'jetbrains',
        operation: request.method,
        status: 'failure',
        durationMs: Date.now() - startedAt,
        errorCode: timeout ? 408 : -32000,
        correlationId: request.correlationId,
      }),
    );
    return {
      jsonrpc: '2.0',
      id: request.id,
      status: 'failure',
      error: {
        code: timeout ? 408 : -32000,
        message,
      },
    };
  }
};
