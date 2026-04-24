import * as vscode from 'vscode';
import { MCPToolPort, MCPToolInput, MCPToolResult } from '@omni/core';

/**
 * Reads the full text content of a file in the workspace.
 *
 * Method: 'readFile'
 * Params:
 *   uri  — absolute file path or file:// URI
 *
 * Returns: { uri, content, languageId, lineCount }
 */
export class WorkspaceReadFileTool implements MCPToolPort {
  readonly toolId = 'vscode.workspace.readFile';
  readonly displayName = 'VS Code: Read File';

  async execute(input: MCPToolInput): Promise<MCPToolResult> {
    if (input.method !== 'readFile') {
      return { success: false, error: `Unknown method: ${input.method}. Expected 'readFile'.` };
    }

    const params = input.params as { uri?: string } | undefined;
    if (!params?.uri) {
      return { success: false, error: 'params.uri is required (absolute path or file:// URI).' };
    }

    try {
      const uri = params.uri.startsWith('file://')
        ? vscode.Uri.parse(params.uri)
        : vscode.Uri.file(params.uri);

      const doc = await vscode.workspace.openTextDocument(uri);
      return {
        success: true,
        data: {
          uri: doc.uri.toString(),
          content: doc.getText(),
          languageId: doc.languageId,
          lineCount: doc.lineCount,
        },
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }
}
