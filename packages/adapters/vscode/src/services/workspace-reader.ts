import * as path from 'path';
import * as vscode from 'vscode';
import { MCPRegistry } from '@omni/mcp';

/**
 * Thin infrastructure wrapper over the MCP workspace tools.
 *
 * This is INFRASTRUCTURE, not business logic.
 * It exists so feature code doesn't have to know MCP tool IDs or
 * input shapes — it just calls `readFile`, `findFiles`, etc.
 *
 * Orchestration (what to read, what prompts to build) stays in the
 * team feature folders that depend on this helper.
 */
export class WorkspaceReader {
  constructor(private readonly registry: MCPRegistry) {}

  /** Absolute path of the open workspace root, or throws. */
  get root(): string {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) throw new Error('WorkspaceReader: No workspace folder is open.');
    return root;
  }

  /** Path relative to workspace root. */
  toRelative(absolutePath: string): string {
    return path.relative(this.root, absolutePath);
  }

  /** Absolute path from a workspace-relative path. */
  toAbsolute(relativePath: string): string {
    return path.join(this.root, relativePath);
  }

  /**
   * Read the full text of a file.
   * Returns `null` if the file does not exist or cannot be read.
   */
  async readFile(absolutePath: string): Promise<string | null> {
    const result = await this.registry.execute('vscode.workspace.readFile', {
      method: 'readFile',
      params: { uri: absolutePath },
    });
    if (!result.success || !result.data) return null;
    return (result.data as { content: string }).content ?? null;
  }

  /**
   * Read a file by workspace-relative path (e.g. 'docs/architecture.md').
   * Returns `null` if the file does not exist or cannot be read.
   */
  async readRelative(relativePath: string): Promise<string | null> {
    return this.readFile(this.toAbsolute(relativePath));
  }

  /**
   * Find files in the workspace matching a glob pattern.
   * Returns absolute paths.
   */
  async findFiles(
    include: string,
    exclude = '**/node_modules/**',
    maxResults = 50,
  ): Promise<string[]> {
    const result = await this.registry.execute('vscode.workspace.findFiles', {
      method: 'findFiles',
      params: { include, exclude, maxResults },
    });
    if (!result.success || !result.data) return [];
    return (result.data as { files: string[] }).files ?? [];
  }

  /**
   * Read multiple files at once.
   * Files that fail to load are silently skipped.
   * Returns `{ relativePath, content }[]`.
   */
  async readMany(absolutePaths: string[]): Promise<Array<{ relativePath: string; content: string }>> {
    const settled = await Promise.allSettled(
      absolutePaths.map(async (p) => {
        const content = await this.readFile(p);
        return content !== null ? { relativePath: this.toRelative(p), content } : null;
      }),
    );
    return settled
      .filter(
        (r): r is PromiseFulfilledResult<{ relativePath: string; content: string }> =>
          r.status === 'fulfilled' && r.value !== null,
      )
      .map((r) => r.value);
  }

  /**
   * List contents of a directory.
   * Returns an array of entry names.
   */
  async listDirectory(absolutePath: string): Promise<string[]> {
    const result = await this.registry.execute('vscode.workspace.listDirectory', {
      method: 'listDirectory',
      params: { uri: absolutePath },
    });
    if (!result.success || !result.data) return [];
    return (result.data as { entries: string[] }).entries ?? [];
  }

  /**
   * Get VS Code diagnostics for a file or the whole workspace.
   * Returns the raw diagnostics data from the MCP tool.
   */
  async getDiagnostics(absolutePath?: string): Promise<unknown> {
    const result = await this.registry.execute('vscode.languages.getDiagnostics', {
      method: 'getDiagnostics',
      params: absolutePath ? { uri: absolutePath } : {},
    });
    return result.success ? result.data : null;
  }
}
