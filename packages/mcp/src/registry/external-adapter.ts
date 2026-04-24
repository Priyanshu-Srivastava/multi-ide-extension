import {
  MCPToolPort,
  MCPToolInput,
  MCPToolResult,
  SidecarRequest,
  SidecarResponse,
  SidecarTransport,
} from '@omni/core';

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
  private requestCounter = 0;

  constructor(options: {
    toolId: string;
    displayName: string;
    teamId: string;
    transport: SidecarTransport;
  }) {
    this.toolId = options.toolId;
    this.displayName = options.displayName;
    this.teamId = options.teamId;
    this.transport = options.transport;
  }

  async execute(input: MCPToolInput): Promise<MCPToolResult> {
    const request: SidecarRequest = {
      jsonrpc: '2.0',
      id: ++this.requestCounter,
      method: input.method,
      params: input.params,
    };

    let response: SidecarResponse;
    try {
      response = await this.transport(request);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Transport error: ${message}` };
    }

    if (response.error) {
      return {
        success: false,
        error: `[${response.error.code}] ${response.error.message}`,
      };
    }

    return { success: true, data: response.result };
  }
}
