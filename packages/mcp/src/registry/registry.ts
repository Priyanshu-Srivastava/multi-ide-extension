import {
  MCPErrorClass,
  MCPInvocationStatus,
  MCPToolPort,
  MCPToolInput,
  MCPToolResult,
  SidecarTransport,
} from '@omni/core';
import { MCPConfig, isToolEnabled } from '../config';
import { ExternalMCPToolAdapter, MCPInvocationEvent, MCPMetricEvent } from './external-adapter';

export interface GlobalGitHubToolDefinition {
  toolId: string;
  displayName: string;
  teamId: string;
}

export const GLOBAL_GITHUB_TOOLS: ReadonlyArray<GlobalGitHubToolDefinition> = [
  {
    toolId: 'github.pull_request_read',
    displayName: 'GitHub PR Read',
    teamId: 'controller-pod',
  },
  {
    toolId: 'github.list_pull_requests',
    displayName: 'GitHub List Pull Requests',
    teamId: 'controller-pod',
  },
  {
    toolId: 'github.pull_request_review_write',
    displayName: 'GitHub PR Review Write',
    teamId: 'controller-pod',
  },
  {
    toolId: 'github.add_comment_to_pending_review',
    displayName: 'GitHub Add Comment to Pending Review',
    teamId: 'controller-pod',
  },
];

export interface MCPRegistryHooks {
  onInvocation?: (event: MCPInvocationEvent) => void;
  onMetric?: (event: MCPMetricEvent) => void;
}

function classifyError(result: MCPToolResult): MCPErrorClass | undefined {
  if (result.errorClass) {
    return result.errorClass;
  }

  const message = (result.error ?? '').toLowerCase();
  if (!message) {
    return undefined;
  }
  if (message.includes('timeout') || message.includes('timed out') || message.includes('rate limit')) {
    return 'transient';
  }
  return 'permanent';
}

function normalizeResult(toolResult: MCPToolResult, input: MCPToolInput): MCPToolResult {
  return {
    ...toolResult,
    status: toolResult.status ?? (toolResult.success ? 'success' : 'failure'),
    correlationId: toolResult.correlationId ?? input.correlationId,
  };
}

function getIde(input: MCPToolInput): string {
  const ide = input.params?.ide;
  return typeof ide === 'string' && ide.length > 0 ? ide : 'unknown';
}

/**
 * Central MCP Tool Registry.
 *
 * - Teams register their tools once at startup.
 * - Any consumer can resolve a tool by ID and call it.
 * - Activation/deactivation is driven by MCPConfig (loaded from mcp.config.json or IDE settings).
 */
export class MCPRegistry {
  private readonly tools = new Map<string, MCPToolPort>();
  private config: MCPConfig;
  private readonly hooks: MCPRegistryHooks;

  constructor(config: MCPConfig, hooks: MCPRegistryHooks = {}) {
    this.config = config;
    this.hooks = hooks;
  }

  /**
   * Register a tool implementation.
   * Works for both internal team tools and ExternalMCPToolAdapter instances.
   * Throws if a tool with the same ID is already registered.
   */
  register(tool: MCPToolPort): void {
    if (this.tools.has(tool.toolId)) {
      throw new Error(
        `MCPRegistry: Tool "${tool.toolId}" is already registered.`
      );
    }
    this.tools.set(tool.toolId, tool);
  }

  hasTool(toolId: string): boolean {
    return this.tools.has(toolId);
  }

  /**
   * Deregister a tool by ID (e.g. on extension deactivation or hot-reload).
   */
  deregister(toolId: string): void {
    this.tools.delete(toolId);
  }

  /**
   * Execute a registered, enabled tool.
   * Returns an error result if the tool is unknown or disabled in config.
   */
  async execute(toolId: string, input: MCPToolInput): Promise<MCPToolResult> {
    const startedAt = Date.now();

    if (!isToolEnabled(this.config, toolId)) {
      const failure = normalizeResult(
        {
          success: false,
          error: `Tool "${toolId}" is disabled in config.`,
          errorClass: 'permanent',
        },
        input,
      );
      this.emit(toolId, input.method, input, failure, startedAt);
      return failure;
    }

    const tool = this.tools.get(toolId);
    if (!tool) {
      const failure = normalizeResult(
        {
          success: false,
          error: `Tool "${toolId}" is not registered.`,
          errorClass: 'permanent',
        },
        input,
      );
      this.emit(toolId, input.method, input, failure, startedAt);
      return failure;
    }

    const result = normalizeResult(await tool.execute(input), input);
    if (!result.errorClass && result.success === false) {
      result.errorClass = classifyError(result);
    }
    this.emit(toolId, input.method, input, result, startedAt);
    return result;
  }

  /**
   * Update the active config at runtime (e.g. when IDE settings change).
   */
  updateConfig(config: MCPConfig): void {
    this.config = config;
  }

  /**
   * List all registered tools along with their current activation status.
   */
  listTools(): { toolId: string; displayName: string; enabled: boolean }[] {
    return Array.from(this.tools.values()).map((t) => ({
      toolId: t.toolId,
      displayName: t.displayName,
      enabled: isToolEnabled(this.config, t.toolId),
    }));
  }

  private emit(toolId: string, operation: string, input: MCPToolInput, result: MCPToolResult, startedAt: number): void {
    const durationMs = Date.now() - startedAt;
    const status: MCPInvocationStatus = result.status ?? (result.success ? 'success' : 'failure');
    const ide = getIde(input);

    this.hooks.onInvocation?.({
      toolId,
      displayName: toolId,
      teamId: 'global',
      ide,
      operation,
      status,
      durationMs,
      correlationId: result.correlationId,
      retryAfter: result.retryAfter,
      error: result.error,
      errorClass: result.errorClass,
    });

    console.log(
      JSON.stringify({
        toolId,
        ide,
        operation,
        status,
        durationMs,
        errorCode: result.success ? undefined : -32000,
        correlationId: result.correlationId,
      }),
    );

    this.hooks.onMetric?.({ name: 'mcp_calls_total', value: 1, tags: { toolId, status, ide } });
    this.hooks.onMetric?.({ name: 'mcp_latency_ms', value: durationMs, tags: { toolId, status, ide } });
    this.hooks.onMetric?.({ name: 'mcp_latency_p95', value: durationMs, tags: { toolId, ide } });

    if (result.success) {
      this.hooks.onMetric?.({ name: 'mcp_calls_success_total', value: 1, tags: { toolId, ide } });
    } else {
      this.hooks.onMetric?.({
        name: 'mcp_calls_failure_total',
        value: 1,
        tags: { toolId, errorClass: result.errorClass ?? 'unknown', ide },
      });
      if ((result.error ?? '').toLowerCase().includes('timeout')) {
        this.hooks.onMetric?.({ name: 'mcp_timeout_total', value: 1, tags: { toolId, ide } });
      }
    }
  }
}

export function registerGlobalGitHubTools(
  registry: MCPRegistry,
  getTransport: (tool: GlobalGitHubToolDefinition) => SidecarTransport | undefined,
): string[] {
  const registered: string[] = [];

  for (const tool of GLOBAL_GITHUB_TOOLS) {
    if (registry.hasTool(tool.toolId)) {
      continue;
    }

    const transport = getTransport(tool);
    if (!transport) {
      continue;
    }

    registry.register(
      new ExternalMCPToolAdapter({
        toolId: tool.toolId,
        displayName: tool.displayName,
        teamId: tool.teamId,
        transport,
      }),
    );
    registered.push(tool.toolId);
  }

  return registered;
}
