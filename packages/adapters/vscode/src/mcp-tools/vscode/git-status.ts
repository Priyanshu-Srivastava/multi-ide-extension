import * as vscode from 'vscode';
import { MCPToolPort, MCPToolInput, MCPToolResult } from '@omni/core';

/**
 * Returns git repository state via the VS Code built-in git extension API.
 * Requires the VS Code 'vscode.git' extension (bundled by default).
 *
 * Method: 'status'
 * Params:
 *   repoPath? — absolute path of the git repo root.
 *               Defaults to the first workspace folder.
 *
 * Returns:
 *   {
 *     HEAD: { name, commit, type },
 *     state: "idle" | "checkout" | "rebase" | ...,
 *     workingTreeChanges: Array<{ uri, status }>,
 *     indexChanges: Array<{ uri, status }>,
 *     mergeChanges: Array<{ uri, status }>
 *   }
 */

/** Minimal typings for the vscode.git extension public API */
interface GitExtension {
  readonly enabled: boolean;
  getAPI(version: 1): GitAPI;
}

interface GitAPI {
  repositories: GitRepository[];
  getRepository(uri: vscode.Uri): GitRepository | null;
}

interface GitRepository {
  readonly rootUri: vscode.Uri;
  readonly state: GitRepositoryState;
}

interface GitRepositoryState {
  readonly HEAD: { name?: string; commit?: string; type: number } | undefined;
  readonly workingTreeChanges: GitChange[];
  readonly indexChanges: GitChange[];
  readonly mergeChanges: GitChange[];
}

interface GitChange {
  readonly uri: vscode.Uri;
  readonly status: number; // maps to Status enum values
}

const GIT_STATUS: Record<number, string> = {
  0: 'INDEX_MODIFIED', 1: 'INDEX_ADDED', 2: 'INDEX_DELETED',
  3: 'INDEX_RENAMED', 4: 'INDEX_COPIED',
  5: 'MODIFIED', 6: 'DELETED', 7: 'UNTRACKED',
  8: 'IGNORED', 9: 'INTENT_TO_ADD', 10: 'INTENT_TO_RENAME',
  11: 'TYPE_CHANGED_UNSTAGED', 12: 'ADDED_BY_US', 13: 'ADDED_BY_THEM',
  14: 'DELETED_BY_US', 15: 'DELETED_BY_THEM', 16: 'BOTH_ADDED',
  17: 'BOTH_DELETED', 18: 'BOTH_MODIFIED',
};

const HEAD_TYPE: Record<number, string> = { 0: 'Commit', 1: 'Head', 2: 'Tag' };

function serializeChanges(changes: GitChange[]) {
  return changes.map((c) => ({
    uri: c.uri.fsPath,
    status: GIT_STATUS[c.status] ?? String(c.status),
  }));
}

export class GitStatusTool implements MCPToolPort {
  readonly toolId = 'vscode.git.status';
  readonly displayName = 'VS Code: Git Status';

  async execute(input: MCPToolInput): Promise<MCPToolResult> {
    if (input.method !== 'status') {
      return { success: false, error: `Unknown method: ${input.method}. Expected 'status'.` };
    }

    const gitExt = vscode.extensions.getExtension<GitExtension>('vscode.git');
    if (!gitExt) {
      return { success: false, error: 'Built-in git extension (vscode.git) is not installed.' };
    }
    if (!gitExt.isActive) {
      await gitExt.activate();
    }

    const git = gitExt.exports.getAPI(1);

    const params = input.params as { repoPath?: string } | undefined;
    let repo: GitRepository | null = null;

    if (params?.repoPath) {
      repo = git.getRepository(vscode.Uri.file(params.repoPath));
    } else if (git.repositories.length > 0) {
      repo = git.repositories[0];
    }

    if (!repo) {
      return { success: false, error: 'No git repository found.' };
    }

    const s = repo.state;
    return {
      success: true,
      data: {
        repoRoot: repo.rootUri.fsPath,
        HEAD: s.HEAD
          ? {
              name:   s.HEAD.name ?? null,
              commit: s.HEAD.commit ?? null,
              type:   HEAD_TYPE[s.HEAD.type] ?? String(s.HEAD.type),
            }
          : null,
        workingTreeChanges: serializeChanges(s.workingTreeChanges),
        indexChanges:       serializeChanges(s.indexChanges),
        mergeChanges:       serializeChanges(s.mergeChanges),
      },
    };
  }
}
