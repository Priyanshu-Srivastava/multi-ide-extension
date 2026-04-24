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

type TeamFeatures = { openMathPanel: (context: vscode.ExtensionContext, teamId: string) => void };

let registry: MCPRegistry | undefined;

class MCPToolsViewProvider implements vscode.TreeDataProvider<ToolItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ToolItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private registry: MCPRegistry) {}

  getTreeItem(element: ToolItem): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label);
    item.description = element.toolId;
    item.iconPath = new vscode.ThemeIcon(element.enabled ? 'check' : 'circle-outline');
    item.contextValue = element.toolId;
    return item;
  }

  getChildren(): ToolItem[] {
    return this.registry
      .listTools()
      .map((tool) => ({
        label: tool.displayName,
        toolId: tool.toolId,
        enabled: tool.enabled,
      }));
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(null);
  }
}

interface ToolItem {
  label: string;
  toolId: string;
  enabled: boolean;
}

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

  // Sidebar view provider
  const toolsViewProvider = new MCPToolsViewProvider(registry);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('omni-tools', toolsViewProvider)
  );

  // Status bar
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
  statusBar.text = `$(plug) Omni [${TEAM_ID}]`;
  statusBar.tooltip = `Omni IDE Extension — Team: ${TEAM_ID}`;
  statusBar.command = `omni.${TEAM_ID}.showInfo`;
  statusBar.show();
  context.subscriptions.push(statusBar);

  // Commands
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const teamFeatures = require(`@omni/${TEAM_ID}`) as TeamFeatures;

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

    vscode.commands.registerCommand(`omni.${TEAM_ID}.openMath`, () => {
      teamFeatures.openMathPanel(context, TEAM_ID);
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
