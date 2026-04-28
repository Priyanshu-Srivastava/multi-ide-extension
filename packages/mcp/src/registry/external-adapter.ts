import {
  MCPErrorClass,
  MCPInvocationStatus,
  MCPToolPort,
  MCPToolInput,
  MCPToolResult,
  SidecarRequest,
  SidecarResponse,
  SidecarTransport,
} from '@omni/core';

export interface MCPInvocationEvent {
  toolId: string;
  displayName: string;
  teamId: string;
  ide?: string;
  operation: string;
  status: MCPInvocationStatus;
  durationMs: number;
  correlationId?: string;
  retryAfter?: number;
  error?: string;
  errorCode?: number;
  errorClass?: MCPErrorClass;
}

export interface MCPMetricEvent {
  name: string;
  value: number;
  tags?: Record<string, string>;
}

function emitStructuredLog(event: MCPInvocationEvent): void {
  console.log(JSON.stringify(event));
}

function classifyError(code: number | undefined, message: string): MCPErrorClass {
  const normalized = message.toLowerCase();
  if (code === 408 || code === 429 || (code !== undefined && code >= 500)) {
    return 'transient';
  }
  if (normalized.includes('timeout') || normalized.includes('timed out') || normalized.includes('rate limit')) {
    return 'transient';
  }
  return 'permanent';
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function getIde(input: MCPToolInput): string {
  const params = asRecord(input.params);
  const ide = params?.ide;
  return typeof ide === 'string' && ide.length > 0 ? ide : 'unknown';
}

function getRetryAfterSeconds(message: string, response?: SidecarResponse): number | undefined {
  const fromError = response?.error;
  if (typeof fromError?.retryAfter === 'number') {
    return fromError.retryAfter;
  }

  if (typeof response?.retryAfter === 'number') {
    return response.retryAfter;
  }

  const data = asRecord(fromError?.data);
  if (data) {
    const retryAfter = data.retryAfter;
    if (typeof retryAfter === 'number') {
      return retryAfter;
    }

    const retryAfterHeader = data['retry-after'];
    if (typeof retryAfterHeader === 'number') {
      return retryAfterHeader;
    }
    if (typeof retryAfterHeader === 'string') {
      const parsed = parseInt(retryAfterHeader, 10);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }

  const match = message.match(/retry\s*after\s*[:=]?\s*(\d+)/i);
  if (match) {
    const parsed = parseInt(match[1], 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function extractToolError(result: unknown): string | undefined {
  const body = asRecord(result);
  if (!body || body.isError !== true) {
    return undefined;
  }

  const content = body.content;
  if (Array.isArray(content)) {
    const first = asRecord(content[0]);
    if (first && typeof first.text === 'string' && first.text.length > 0) {
      return first.text;
    }
  }

  return 'External MCP tool returned an error result.';
}

function parseJsonIfPossible(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    return text;
  }

  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}'))
    || (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return text;
    }
  }

  return text;
}

export function parseMixedContentPayload(result: unknown): unknown {
  const body = asRecord(result);
  if (!body) {
    return result;
  }

  if (body.structuredContent !== undefined) {
    return body.structuredContent;
  }

  const content = body.content;
  if (!Array.isArray(content)) {
    return result;
  }

  const parsedItems = content
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => !!item)
    .map((item) => {
      if (typeof item.text === 'string') {
        return parseJsonIfPossible(item.text);
      }
      return item;
    });

  if (parsedItems.length === 0) {
    return result;
  }

  if (parsedItems.length === 1) {
    return parsedItems[0];
  }

  return parsedItems;
}

/**
 * Wraps an external MCP server (stdio, SSE, or HTTP transport) behind MCPToolPort.
 *
 * Used for BUILT-IN MCP servers (e.g. @modelcontextprotocol/server-github).
 * The server process/URL is configured in mcp.config.json → settings.endpoint.
 *
 * The extension connects to the external server as an MCP CLIENT.
 * The server itself does NOT live in this repo.
 */
export class ExternalMCPToolAdapter implements MCPToolPort {
  readonly toolId: string;
  readonly displayName: string;
  readonly teamId: string;

  private readonly transport: SidecarTransport;
  private readonly onInvocation?: (event: MCPInvocationEvent) => void;
  private readonly onMetric?: (metric: MCPMetricEvent) => void;
  private requestCounter = 0;

  constructor(options: {
    toolId: string;
    displayName: string;
    teamId: string;
    transport: SidecarTransport;
    onInvocation?: (event: MCPInvocationEvent) => void;
    onMetric?: (metric: MCPMetricEvent) => void;
  }) {
    this.toolId = options.toolId;
    this.displayName = options.displayName;
    this.teamId = options.teamId;
    this.transport = options.transport;
    this.onInvocation = options.onInvocation;
    this.onMetric = options.onMetric;
  }

  async execute(input: MCPToolInput): Promise<MCPToolResult> {
    const startedAt = Date.now();
    const request: SidecarRequest = {
      jsonrpc: '2.0',
      id: ++this.requestCounter,
      method: input.method,
      params: input.params,
      correlationId: input.correlationId,
    };

    let response: SidecarResponse;
    const ide = getIde(input);
    try {
      response = await this.transport(request);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const durationMs = Date.now() - startedAt;
      const errorClass = classifyError(undefined, message);
      const failure: MCPToolResult = {
        success: false,
        status: 'failure',
        correlationId: input.correlationId,
        error: `Transport error: ${message}`,
        errorClass,
        retryAfter: getRetryAfterSeconds(message),
      };
      this.onInvocation?.({
        toolId: this.toolId,
        displayName: this.displayName,
        teamId: this.teamId,
        ide,
        operation: input.method,
        status: 'failure',
        durationMs,
        correlationId: input.correlationId,
        retryAfter: failure.retryAfter,
        error: failure.error,
        errorClass,
      });
      emitStructuredLog({
        toolId: this.toolId,
        displayName: this.displayName,
        teamId: this.teamId,
        ide,
        operation: input.method,
        status: 'failure',
        durationMs,
        correlationId: input.correlationId,
        retryAfter: failure.retryAfter,
        error: failure.error,
        errorClass,
      });
      this.onMetric?.({ name: 'mcp_calls_total', value: 1, tags: { toolId: this.toolId, status: 'failure', ide } });
      this.onMetric?.({ name: 'mcp_calls_failure_total', value: 1, tags: { toolId: this.toolId, errorClass, ide } });
      this.onMetric?.({ name: 'mcp_latency_ms', value: durationMs, tags: { toolId: this.toolId, status: 'failure', ide } });
      this.onMetric?.({ name: 'mcp_latency_p95', value: durationMs, tags: { toolId: this.toolId, ide } });
      return failure;
    }

    const durationMs = Date.now() - startedAt;

    if (response.error) {
      const message = `[${response.error.code}] ${response.error.message}`;
      const errorClass = classifyError(response.error.code, message);
      const retryAfter = getRetryAfterSeconds(message, response);
      const failure: MCPToolResult = {
        success: false,
        status: 'failure',
        correlationId: input.correlationId,
        error: message,
        errorClass,
        retryAfter,
      };
      this.onInvocation?.({
        toolId: this.toolId,
        displayName: this.displayName,
        teamId: this.teamId,
        ide,
        operation: input.method,
        status: 'failure',
        durationMs,
        correlationId: input.correlationId,
        retryAfter,
        error: failure.error,
        errorCode: response.error.code,
        errorClass,
      });
      emitStructuredLog({
        toolId: this.toolId,
        displayName: this.displayName,
        teamId: this.teamId,
        ide,
        operation: input.method,
        status: 'failure',
        durationMs,
        correlationId: input.correlationId,
        retryAfter,
        error: failure.error,
        errorCode: response.error.code,
        errorClass,
      });
      this.onMetric?.({ name: 'mcp_calls_total', value: 1, tags: { toolId: this.toolId, status: 'failure', ide } });
      this.onMetric?.({ name: 'mcp_calls_failure_total', value: 1, tags: { toolId: this.toolId, errorClass, ide } });
      if ((failure.error ?? '').toLowerCase().includes('timeout')) {
        this.onMetric?.({ name: 'mcp_timeout_total', value: 1, tags: { toolId: this.toolId, ide } });
      }
      this.onMetric?.({ name: 'mcp_latency_ms', value: durationMs, tags: { toolId: this.toolId, status: 'failure', ide } });
      this.onMetric?.({ name: 'mcp_latency_p95', value: durationMs, tags: { toolId: this.toolId, ide } });
      return {
        ...failure,
      };
    }

    const toolError = extractToolError(response.result);
    if (toolError) {
      const errorClass = classifyError(undefined, toolError);
      const retryAfter = getRetryAfterSeconds(toolError, response);
      const failure: MCPToolResult = {
        success: false,
        status: 'failure',
        correlationId: input.correlationId,
        error: toolError,
        errorClass,
        retryAfter,
      };
      this.onInvocation?.({
        toolId: this.toolId,
        displayName: this.displayName,
        teamId: this.teamId,
        ide,
        operation: input.method,
        status: 'failure',
        durationMs,
        correlationId: input.correlationId,
        retryAfter,
        error: toolError,
        errorClass,
      });
      emitStructuredLog({
        toolId: this.toolId,
        displayName: this.displayName,
        teamId: this.teamId,
        ide,
        operation: input.method,
        status: 'failure',
        durationMs,
        correlationId: input.correlationId,
        retryAfter,
        error: toolError,
        errorClass,
      });
      this.onMetric?.({ name: 'mcp_calls_total', value: 1, tags: { toolId: this.toolId, status: 'failure', ide } });
      this.onMetric?.({ name: 'mcp_calls_failure_total', value: 1, tags: { toolId: this.toolId, errorClass, ide } });
      this.onMetric?.({ name: 'mcp_latency_ms', value: durationMs, tags: { toolId: this.toolId, status: 'failure', ide } });
      this.onMetric?.({ name: 'mcp_latency_p95', value: durationMs, tags: { toolId: this.toolId, ide } });
      return failure;
    }

    const success: MCPToolResult = {
      success: true,
      status: response.status ?? 'success',
      correlationId: input.correlationId ?? response.correlationId,
      data: parseMixedContentPayload(response.result),
      retryAfter: response.retryAfter,
    };
    this.onInvocation?.({
      toolId: this.toolId,
      displayName: this.displayName,
      teamId: this.teamId,
      ide,
      operation: input.method,
      status: 'success',
      durationMs,
      correlationId: success.correlationId,
      retryAfter: success.retryAfter,
    });
    emitStructuredLog({
      toolId: this.toolId,
      displayName: this.displayName,
      teamId: this.teamId,
      ide,
      operation: input.method,
      status: 'success',
      durationMs,
      correlationId: success.correlationId,
      retryAfter: success.retryAfter,
    });
    this.onMetric?.({ name: 'mcp_calls_total', value: 1, tags: { toolId: this.toolId, status: 'success', ide } });
    this.onMetric?.({ name: 'mcp_calls_success_total', value: 1, tags: { toolId: this.toolId, ide } });
    this.onMetric?.({ name: 'mcp_latency_ms', value: durationMs, tags: { toolId: this.toolId, status: 'success', ide } });
    this.onMetric?.({ name: 'mcp_latency_p95', value: durationMs, tags: { toolId: this.toolId, ide } });
    return success;
  }
}
