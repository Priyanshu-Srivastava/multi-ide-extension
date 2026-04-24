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

// ---------------------------------------------------------------------------
// Feature descriptors — add an entry here whenever a team ships a new feature.
// hasUI: true  → clicking the item opens the feature's webview panel.
// hasUI: false → clicking runs a background command with no visual panel.
// ---------------------------------------------------------------------------
const TEAM_FEATURES: Array<{ id: string; label: string; hasUI: boolean }> = [
  { id: 'openMath', label: 'Math Panel', hasUI: true },
];

interface FeatureNode {
  kind: 'header' | 'feature';
  label: string;
  featureId?: string;
  hasUI?: boolean;
}

class FeaturesViewProvider implements vscode.TreeDataProvider<FeatureNode> {
  getTreeItem(element: FeatureNode): vscode.TreeItem {
    if (element.kind === 'header') {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Expanded);
      item.iconPath    = new vscode.ThemeIcon('organization');
      item.contextValue = 'teamHeader';
      return item;
    }

    // feature row
    const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
    item.iconPath    = new vscode.ThemeIcon(element.hasUI ? 'layout-panel' : 'run');
    item.contextValue = 'feature';
    if (element.hasUI) {
      item.tooltip = `Open ${element.label}`;
      item.command = {
        command: `omni.${TEAM_ID}.feature.${element.featureId}`,
        title:   `Open ${element.label}`,
      };
    }
    return item;
  }

  getChildren(element?: FeatureNode): FeatureNode[] {
    if (!element) {
      // Root: single team-name header
      const teamLabel = TEAM_ID.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      return [{ kind: 'header', label: teamLabel }];
    }
    if (element.kind === 'header') {
      return TEAM_FEATURES.map((f) => ({
        kind:      'feature' as const,
        label:     f.label,
        featureId: f.id,
        hasUI:     f.hasUI,
      }));
    }
    return [];
  }
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

  // Sidebar — one Features view per team to avoid conflicts across installed extensions.
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(`omni-features-${TEAM_ID}`, new FeaturesViewProvider()),
  );

  // Status bar
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
  statusBar.text    = `$(plug) Omni [${TEAM_ID}]`;
  statusBar.tooltip = `Omni IDE Extension — Team: ${TEAM_ID}`;
  statusBar.command = `omni.${TEAM_ID}.showInfo`;
  statusBar.show();
  context.subscriptions.push(statusBar);

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const teamFeatures = require(`@omni/${TEAM_ID}`) as TeamFeatures;

  context.subscriptions.push(
    // Status-bar info command
    vscode.commands.registerCommand(`omni.${TEAM_ID}.showInfo`, () => {
      vscode.window.showInformationMessage(`Omni IDE — ${TEAM_ID}`);
    }),

    // Feature commands — one per TEAM_FEATURES entry
    vscode.commands.registerCommand(`omni.${TEAM_ID}.feature.openMath`, () => {
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
