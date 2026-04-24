import { MCPToolPort, MCPToolInput, MCPToolResult } from '@omni/core';
import { MCPConfig, isToolEnabled } from '../config';

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

  constructor(config: MCPConfig) {
    this.config = config;
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
    if (!isToolEnabled(this.config, toolId)) {
      return { success: false, error: `Tool "${toolId}" is disabled in config.` };
    }

    const tool = this.tools.get(toolId);
    if (!tool) {
      return { success: false, error: `Tool "${toolId}" is not registered.` };
    }

    return tool.execute(input);
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
}
