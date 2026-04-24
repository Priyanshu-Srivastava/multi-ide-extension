import * as vscode from 'vscode';
import { MCPToolPort, MCPToolInput, MCPToolResult } from '@omni/core';

/**
 * Returns errors, warnings and hints from VS Code's language diagnostics.
 *
 * Method: 'getDiagnostics'
 * Params:
 *   uri? — absolute file path or file:// URI. Omit to get diagnostics for ALL files.
 *
 * Returns:
 *   { diagnostics: Array<{ uri, severity, message, range, source, code }> }
 */
export class GetDiagnosticsTool implements MCPToolPort {
  readonly toolId = 'vscode.languages.getDiagnostics';
  readonly displayName = 'VS Code: Get Diagnostics';

  async execute(input: MCPToolInput): Promise<MCPToolResult> {
    if (input.method !== 'getDiagnostics') {
      return { success: false, error: `Unknown method: ${input.method}. Expected 'getDiagnostics'.` };
    }

    const params = input.params as { uri?: string } | undefined;

    try {
      const raw: [vscode.Uri, vscode.Diagnostic[]][] = params?.uri
        ? [[
            params.uri.startsWith('file://')
              ? vscode.Uri.parse(params.uri)
              : vscode.Uri.file(params.uri),
            vscode.languages.getDiagnostics(
              params.uri.startsWith('file://')
                ? vscode.Uri.parse(params.uri)
                : vscode.Uri.file(params.uri)
            ),
          ]]
        : vscode.languages.getDiagnostics();

      const diagnostics = raw.flatMap(([uri, diags]) =>
        diags.map((d) => ({
          uri: uri.toString(),
          severity: vscode.DiagnosticSeverity[d.severity], // "Error" | "Warning" | "Information" | "Hint"
          message: d.message,
          range: {
            start: { line: d.range.start.line, character: d.range.start.character },
            end:   { line: d.range.end.line,   character: d.range.end.character },
          },
          source: d.source ?? null,
          code: d.code ?? null,
        }))
      );

      return { success: true, data: { diagnostics } };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }
}
