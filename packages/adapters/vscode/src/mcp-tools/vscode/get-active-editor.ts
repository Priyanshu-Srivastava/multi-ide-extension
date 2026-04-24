import * as vscode from 'vscode';
import { MCPToolPort, MCPToolInput, MCPToolResult } from '@omni/core';

/**
 * Returns information about the currently active (focused) text editor.
 *
 * Method: 'getActiveEditor'
 * Params: none
 *
 * Returns:
 *   { uri, languageId, lineCount, cursorLine, cursorCharacter, selection, isDirty }
 *   or { active: false } when no editor is open.
 */
export class GetActiveEditorTool implements MCPToolPort {
  readonly toolId = 'vscode.window.getActiveEditor';
  readonly displayName = 'VS Code: Get Active Editor';

  async execute(input: MCPToolInput): Promise<MCPToolResult> {
    if (input.method !== 'getActiveEditor') {
      return { success: false, error: `Unknown method: ${input.method}. Expected 'getActiveEditor'.` };
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return { success: true, data: { active: false } };
    }

    const sel = editor.selection;
    return {
      success: true,
      data: {
        active: true,
        uri: editor.document.uri.toString(),
        languageId: editor.document.languageId,
        lineCount: editor.document.lineCount,
        isDirty: editor.document.isDirty,
        cursor: { line: sel.active.line, character: sel.active.character },
        selection: sel.isEmpty
          ? null
          : {
              start: { line: sel.start.line, character: sel.start.character },
              end:   { line: sel.end.line,   character: sel.end.character },
              selectedText: editor.document.getText(sel),
            },
      },
    };
  }
}
