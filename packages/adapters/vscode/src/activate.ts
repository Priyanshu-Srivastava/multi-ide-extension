import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MCPRegistry } from '@omni/mcp';
import type { MCPConfig } from '@omni/mcp';
import {
  WorkspaceReadFileTool,
  WorkspaceFindFilesTool,
  WorkspaceWriteFileTool,
  WorkspaceListDirectoryTool,
  GetDiagnosticsTool,
  ExecuteCommandTool,
  GetActiveEditorTool,
  GitStatusTool,
} from './mcp-tools';
import { TEAM_ID } from './__generated__/team-config';

let registry: MCPRegistry | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const config = resolveConfig(context);
  registry = new MCPRegistry(config);

  [
    new WorkspaceReadFileTool(),
    new WorkspaceFindFilesTool(),
    new WorkspaceWriteFileTool(),
    new WorkspaceListDirectoryTool(),
    new GetDiagnosticsTool(),
    new ExecuteCommandTool(),
    new GetActiveEditorTool(),
    new GitStatusTool(),
  ].forEach((tool) => registry!.register(tool));

  // Status bar
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
  statusBar.text = `$(plug) Omni [${TEAM_ID}]`;
  statusBar.tooltip = `Omni IDE Extension — Team: ${TEAM_ID}`;
  statusBar.command = `omni.${TEAM_ID}.showInfo`;
  statusBar.show();
  context.subscriptions.push(statusBar);

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand(`omni.${TEAM_ID}.showInfo`, () => {
      const toolList = registry!
        .listTools()
        .map((t) => `${t.enabled ? '✓' : '✗'}  ${t.toolId}`)
        .join('\n');
      vscode.window.showInformationMessage(
        `Omni IDE [${TEAM_ID}]\n\nRegistered MCP tools:\n${toolList}`
      );
    }),

    vscode.commands.registerCommand(`omni.${TEAM_ID}.listTools`, () => {
      const items = registry!.listTools().map((t) => ({
        label:       t.displayName,
        description: t.toolId,
        detail:      t.enabled ? '● Enabled' : '○ Disabled',
      }));
      vscode.window.showQuickPick(items, {
        title:       `Omni MCP Tools — ${TEAM_ID}`,
        matchOnDetail: true,
      });
    }),
  );
}

export function deactivate(): void {
  registry = undefined;
}

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

const VS_CODE_TOOL_IDS = [
  'vscode.workspace.readFile',
  'vscode.workspace.findFiles',
  'vscode.workspace.writeFile',
  'vscode.workspace.listDirectory',
  'vscode.languages.getDiagnostics',
  'vscode.commands.executeCommand',
  'vscode.window.getActiveEditor',
  'vscode.git.status',
];

function resolveConfig(context: vscode.ExtensionContext): MCPConfig {
  const configPath = path.join(context.extensionPath, 'mcp.config.json');
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as MCPConfig;
    } catch {
      // corrupt config — fall through to default
    }
  }
  // Default: enable all VS Code MCP tools
  return {
    version: '1',
    tools: VS_CODE_TOOL_IDS.map((toolId) => ({ toolId, enabled: true })),
  };
}
