import * as vscode from 'vscode';
import { MCPToolPort, MCPToolInput, MCPToolResult } from '@omni/core';

/**
 * Executes any registered VS Code command (built-in or extension-contributed).
 *
 * Method: 'executeCommand'
 * Params:
 *   command — VS Code command ID (e.g. "editor.action.formatDocument")
 *   args?   — array of arguments forwarded to the command
 *
 * Returns: { result } — the raw return value of the command (may be undefined)
 */
export class ExecuteCommandTool implements MCPToolPort {
  readonly toolId = 'vscode.commands.executeCommand';
  readonly displayName = 'VS Code: Execute Command';

  async execute(input: MCPToolInput): Promise<MCPToolResult> {
    if (input.method !== 'executeCommand') {
      return { success: false, error: `Unknown method: ${input.method}. Expected 'executeCommand'.` };
    }

    const params = input.params as { command?: string; args?: unknown[] } | undefined;
    if (!params?.command) {
      return { success: false, error: 'params.command is required.' };
    }

    try {
      const result = await vscode.commands.executeCommand(
        params.command,
        ...(params.args ?? [])
      );
      return { success: true, data: { result: result ?? null } };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }
}
