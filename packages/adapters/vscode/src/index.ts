import { IDEActionPort, TelemetryPort } from '@omni/core';

export class VSCodeAdapter implements IDEActionPort {
  constructor(private telemetry: TelemetryPort) {}

  async executeCommand(command: string, payload?: unknown): Promise<unknown> {
    this.telemetry.recordEvent('vscode_command', { command, payload });
    return { status: 'ok', command, payload };
  }
}

// Extension entry point (activate/deactivate) — re-exported for cursor adapter reuse
export { activate, deactivate } from './activate';

// Runtime accessors — team feature code calls these to get live infrastructure instances
export { getLLMAdapter, getMCPRegistry, discoverAvailableModels } from './activate';

// MCP tools — re-exported for convenience so callers can import from '@omni/adapters-vscode'
export * from './mcp-tools';

// Infrastructure helpers — team feature code builds on these
export * from './services';
