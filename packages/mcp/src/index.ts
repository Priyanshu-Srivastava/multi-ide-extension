/**
 * @omni/mcp — MCP Tool integration layer.
 *
 * All MCP tools are GLOBAL to the project. Tool implementations live in
 * packages/mcp/src/tools/ and are shared across all teams and adapters.
 * No team owns a tool — teams consume them via MCPRegistry.
 *
 * Two kinds of tools:
 *
 * 1. BUILT-IN project tools (packages/mcp/src/tools/):
 *    - Implement MCPToolPort from '@omni/core'
 *    - Export from tools/index.ts barrel
 *    - Automatically available to all teams via MCPRegistry
 *
 * 2. EXTERNAL MCP servers (e.g. @modelcontextprotocol/server-github):
 *    - Wrap with ExternalMCPToolAdapter pointing to the server's transport
 *    - Register the adapter with MCPRegistry — treated identically to built-in tools
 *    - The server itself lives outside this repo
 *
 * Example (adapter activate()):
 *   import { MCPRegistry, ExternalMCPToolAdapter, ExampleTool } from '@omni/mcp';
 *
 *   const registry = new MCPRegistry(config);
 *   // built-in project tool
 *   registry.register(new ExampleTool());
 *   // external MCP server
 *   registry.register(new ExternalMCPToolAdapter({ toolId: 'github', ...transport }));
 *   const result = await registry.execute('omni-example', { method: 'ping', params: {} });
 */
export { MCPRegistry, ExternalMCPToolAdapter } from './registry';
export { MCPConfig, MCPToolConfig, getToolConfig, isToolEnabled } from './config';
export { ExampleTool } from './tools';
