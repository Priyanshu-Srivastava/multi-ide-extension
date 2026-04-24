import { MCPToolPort, MCPToolInput, MCPToolResult } from '@omni/core';

/**
 * Example built-in MCP tool for the project.
 * Add project-wide tools here in packages/mcp/src/tools/.
 * These are global — available to all teams and adapters.
 */
export class ExampleTool implements MCPToolPort {
  readonly toolId = 'omni-example';
  readonly displayName = 'Omni: Example Tool';

  async execute(input: MCPToolInput): Promise<MCPToolResult> {
    if (input.method === 'ping') {
      return { success: true, data: { pong: true } };
    }
    return { success: false, error: `Unknown method: ${input.method}` };
  }
}
