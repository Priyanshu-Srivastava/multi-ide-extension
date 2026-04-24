import * as vscode from 'vscode';
import { MCPToolPort, MCPToolInput, MCPToolResult } from '@omni/core';

/**
 * Lists entries (files and folders) inside a directory.
 *
 * Method: 'listDirectory'
 * Params:
 *   uri — absolute directory path or file:// URI
 *
 * Returns:
 *   { entries: Array<{ name, type: "File" | "Directory" | "SymbolicLink" }> }
 */
export class WorkspaceListDirectoryTool implements MCPToolPort {
  readonly toolId = 'vscode.workspace.listDirectory';
  readonly displayName = 'VS Code: List Directory';

  async execute(input: MCPToolInput): Promise<MCPToolResult> {
    if (input.method !== 'listDirectory') {
      return { success: false, error: `Unknown method: ${input.method}. Expected 'listDirectory'.` };
    }

    const params = input.params as { uri?: string } | undefined;
    if (!params?.uri) {
      return { success: false, error: 'params.uri is required.' };
    }

    try {
      const uri = params.uri.startsWith('file://')
        ? vscode.Uri.parse(params.uri)
        : vscode.Uri.file(params.uri);

      const entries = await vscode.workspace.fs.readDirectory(uri);

      return {
        success: true,
        data: {
          entries: entries.map(([name, fileType]) => ({
            name,
            type: vscode.FileType[fileType] as 'File' | 'Directory' | 'SymbolicLink' | 'Unknown',
          })),
        },
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }
}
