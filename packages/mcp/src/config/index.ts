/**
 * MCP tool configuration schema.
 * Loaded from mcp.config.json (or injected via IDE settings).
 */
export interface MCPToolConfig {
  /** Must match MCPToolPort.toolId */
  toolId: string;
  enabled: boolean;
  /** Optional per-tool settings, e.g. API keys, endpoints */
  settings?: Record<string, unknown>;
}

export interface MCPConfig {
  version: '1';
  tools: MCPToolConfig[];
}

/**
 * Returns the config entry for a given toolId.
 * Returns undefined if the tool is not listed in config (treated as disabled).
 */
export function getToolConfig(
  config: MCPConfig,
  toolId: string
): MCPToolConfig | undefined {
  return config.tools.find((t) => t.toolId === toolId);
}

/**
 * Checks whether a tool is currently enabled in the provided config.
 */
export function isToolEnabled(config: MCPConfig, toolId: string): boolean {
  return getToolConfig(config, toolId)?.enabled === true;
}
