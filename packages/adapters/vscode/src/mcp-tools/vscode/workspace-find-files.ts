import * as vscode from 'vscode';
import { MCPToolPort, MCPToolInput, MCPToolResult } from '@omni/core';

/**
 * Searches workspace files using glob patterns.
 *
 * Method: 'findFiles'
 * Params:
 *   include  — glob pattern to match (e.g. "**\/*.ts")
 *   exclude? — glob pattern to exclude (e.g. "**\/node_modules\/**")
 *   maxResults? — cap number of results (default: 100)
 *
 * Returns: { files: string[] }
 */
export class WorkspaceFindFilesTool implements MCPToolPort {
  readonly toolId = 'vscode.workspace.findFiles';
  readonly displayName = 'VS Code: Find Files';

  async execute(input: MCPToolInput): Promise<MCPToolResult> {
    if (input.method !== 'findFiles') {
      return { success: false, error: `Unknown method: ${input.method}. Expected 'findFiles'.` };
    }

    const params = input.params as { include?: string; exclude?: string; maxResults?: number } | undefined;
    if (!params?.include) {
      return { success: false, error: 'params.include glob pattern is required.' };
    }

    try {
      const uris = await vscode.workspace.findFiles(
        params.include,
        params.exclude ?? '**/node_modules/**',
        params.maxResults ?? 100
      );
      return {
        success: true,
        data: { files: uris.map((u) => u.fsPath) },
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }
}
