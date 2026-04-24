import * as vscode from 'vscode';
import { MCPToolPort, MCPToolInput, MCPToolResult } from '@omni/core';

/**
 * Writes content to a file in the workspace (creates or overwrites).
 *
 * Method: 'writeFile'
 * Params:
 *   uri     — absolute file path or file:// URI
 *   content — UTF-8 string content to write
 *
 * Returns: { uri }
 */
export class WorkspaceWriteFileTool implements MCPToolPort {
  readonly toolId = 'vscode.workspace.writeFile';
  readonly displayName = 'VS Code: Write File';

  async execute(input: MCPToolInput): Promise<MCPToolResult> {
    if (input.method !== 'writeFile') {
      return { success: false, error: `Unknown method: ${input.method}. Expected 'writeFile'.` };
    }

    const params = input.params as { uri?: string; content?: string } | undefined;
    if (!params?.uri) {
      return { success: false, error: 'params.uri is required.' };
    }
    if (typeof params.content !== 'string') {
      return { success: false, error: 'params.content (string) is required.' };
    }

    try {
      const uri = params.uri.startsWith('file://')
        ? vscode.Uri.parse(params.uri)
        : vscode.Uri.file(params.uri);

      const encoded = new TextEncoder().encode(params.content);
      await vscode.workspace.fs.writeFile(uri, encoded);

      return { success: true, data: { uri: uri.toString() } };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }
}
