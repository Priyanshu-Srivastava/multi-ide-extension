import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MCPRegistry } from '@omni/mcp';
import type { MCPConfig } from '@omni/mcp';
import { LLMProviderRegistry } from '@omni/core';
import type { LLMConfig, LLMPort } from '@omni/core';
import { registerLLMProviders } from './llm';
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
import { WorkspaceReader } from './services';
import { TEAM_ID } from './__generated__/team-config';

type TeamFeatures = {
  openMathPanel: (context: vscode.ExtensionContext, teamId: string) => void;
  openAnalysisPanel?: (
    context: vscode.ExtensionContext,
    reader: WorkspaceReader,
    llm: LLMPort,
  ) => void;
};

let registry: MCPRegistry | undefined;
let llmAdapter: LLMPort | undefined;

// ---------------------------------------------------------------------------
// Feature descriptors — add an entry here whenever a team ships a new feature.
// hasUI: true  → clicking the item opens the feature's webview panel.
// hasUI: false → clicking runs a background command with no visual panel.
// ---------------------------------------------------------------------------
const isTeamD = String(TEAM_ID) === 'team-d';

const TEAM_FEATURES: Array<{ id: string; label: string; hasUI: boolean }> = [
  { id: 'openMath', label: 'Math Panel', hasUI: true },
  ...(isTeamD
    ? [{ id: 'openAnalysis', label: 'Project Analyser', hasUI: true }]
    : []),
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

  // Register all LLM providers and create the initial adapter from settings.
  registerLLMProviders();
  llmAdapter = createLLMAdapterFromSettings(context);

  // Hot-reload LLM adapter when user changes provider settings.
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('omni.llm')) {
        llmAdapter = createLLMAdapterFromSettings(context);
        vscode.window.showInformationMessage(
          `Omni AI provider switched to: ${llmAdapter.provider}`,
        );
      }
    }),
  );

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

    vscode.commands.registerCommand(`omni.${TEAM_ID}.feature.openAnalysis`, () => {
      if (!teamFeatures.openAnalysisPanel) {
        vscode.window.showWarningMessage('Project Analyser is not available for this team package.');
        return;
      }
      const reader = new WorkspaceReader(getMCPRegistry());
      teamFeatures.openAnalysisPanel(context, reader, getLLMAdapter());
    }),
  );
}

export function deactivate(): void {
  registry = undefined;
  llmAdapter = undefined;
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

// ---------------------------------------------------------------------------
// LLM helpers
// ---------------------------------------------------------------------------

function buildLLMConfig(context: vscode.ExtensionContext): LLMConfig {
  const cfg = vscode.workspace.getConfiguration('omni.llm');
  const provider = cfg.get<string>('provider', 'copilot');
  return {
    provider,
    // API key: prefer secret storage (secure), fall back to settings (dev only)
    apiKey: cfg.get<string>('apiKey', ''),
    model: cfg.get<string>('model', '') || undefined,
    options: cfg.get<Record<string, unknown>>('providerOptions', {}),
  };
}

function createLLMAdapterFromSettings(context: vscode.ExtensionContext): LLMPort {
  const config = buildLLMConfig(context);
  const descriptor = LLMProviderRegistry.get(config.provider);
  if (!descriptor) {
    vscode.window.showWarningMessage(
      `Omni: Unknown LLM provider "${config.provider}". Falling back to "copilot".`,
    );
    return LLMProviderRegistry.create({ ...config, provider: 'copilot' });
  }
  if (descriptor.requiresApiKey && !config.apiKey) {
    vscode.window.showWarningMessage(
      `Omni: Provider "${descriptor.displayName}" requires an API key. Set omni.llm.apiKey in settings.`,
    );
  }
  return LLMProviderRegistry.create(config);
}

/** Exported so team feature code can get the active LLM adapter via the adapter package. */
export function getLLMAdapter(): LLMPort {
  if (!llmAdapter) throw new Error('LLM adapter accessed before activate().');
  return llmAdapter;
}

/** Exported so team feature code can construct a WorkspaceReader or call MCP tools directly. */
export function getMCPRegistry(): MCPRegistry {
  if (!registry) throw new Error('MCPRegistry accessed before activate().');
  return registry;
}

/**
 * Dynamically discover all available language models in VS Code.
 * This queries the vscode.lm API directly to find all models (including extensions).
 * Returns model metadata including context size and capabilities.
 */
export async function discoverAvailableModels(): Promise<
  Array<{
    id: string;
    name: string;
    vendor?: string;
    family?: string;
    version?: string;
    maxInputTokens: number;
    contextWindow?: number;
  }>
> {
  try {
    // Selecting with empty criteria returns ALL available models
    const allModels = await vscode.lm.selectChatModels({});
    return allModels.map((model) => ({
      id: model.id,
      name: model.id, // model.id is the display name in practice
      vendor: (model as any).vendor,
      family: (model as any).family,
      version: (model as any).version,
      maxInputTokens: model.maxInputTokens,
      contextWindow: model.maxInputTokens, // alias for clarity
    }));
  } catch (error) {
    console.error('Failed to discover available models:', error);
    return [];
  }
}
