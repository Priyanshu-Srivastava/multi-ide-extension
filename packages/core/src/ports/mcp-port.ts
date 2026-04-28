export type MCPToolStatus = 'active' | 'inactive' | 'error';
export type MCPInvocationStatus = 'success' | 'failure';
export type MCPErrorClass = 'transient' | 'permanent';

/**
 * Describes a single MCP tool contract.
 * Tools are global to the project — not owned by any team.
 * All adapters program against this interface — never a concrete implementation.
 */
export interface MCPToolPort {
  /** Unique identifier for this tool, e.g. "github-search" */
  readonly toolId: string;
  /** Human-readable name */
  readonly displayName: string;
  /** Execute the tool with typed input, returns structured result */
  execute(input: MCPToolInput): Promise<MCPToolResult>;
}

export interface MCPToolInput {
  method: string;
  params?: Record<string, unknown>;
  correlationId?: string;
}

export interface MCPToolResult {
  success: boolean;
  status?: MCPInvocationStatus;
  data?: unknown;
  error?: string;
  correlationId?: string;
  retryAfter?: number;
  errorClass?: MCPErrorClass;
}
