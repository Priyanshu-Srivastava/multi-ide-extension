/**
 * VS Code-specific MCP tool implementations.
 * All tools here wrap vscode.* APIs and must run inside a VS Code extension host.
 * Register them with MCPRegistry inside the extension's activate() function.
 */
export { WorkspaceReadFileTool }    from './workspace-read-file';
export { WorkspaceFindFilesTool }   from './workspace-find-files';
export { WorkspaceWriteFileTool }   from './workspace-write-file';
export { WorkspaceListDirectoryTool } from './workspace-list-directory';
export { GetDiagnosticsTool }       from './get-diagnostics';
export { ExecuteCommandTool }       from './execute-command';
export { GetActiveEditorTool }      from './get-active-editor';
export { GitStatusTool }            from './git-status';
