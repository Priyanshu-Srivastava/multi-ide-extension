import * as vscode from 'vscode';
import type { LLMPort, LLMConfig, LLMContext, LLMProviderDescriptor, LLMProviderFactory, LLMModelInfo } from '@omni/core';

export const COPILOT_PROVIDER_ID = 'copilot';

export const copilotDescriptor: LLMProviderDescriptor = {
  id: COPILOT_PROVIDER_ID,
  displayName: 'GitHub Copilot',
  description: 'Uses the IDE-native Copilot language model. No API key required.',
  requiresApiKey: false,
  defaultModel: 'gpt-4o',
};

function buildPromptMessages(prompt: string, context?: LLMContext): vscode.LanguageModelChatMessage[] {
  const messages: vscode.LanguageModelChatMessage[] = [];

  if (context?.systemInstruction?.trim()) {
    messages.push(
      vscode.LanguageModelChatMessage.User(
        [
          'Follow these instructions for the next request.',
          context.systemInstruction.trim(),
        ].join('\n\n'),
      ),
    );
  }

  if (context?.references?.length) {
    messages.push(
      vscode.LanguageModelChatMessage.User(
        [
          'Use this additional context if it is relevant:',
          ...context.references.map((reference) => `- ${reference}`),
        ].join('\n'),
      ),
    );
  }

  messages.push(vscode.LanguageModelChatMessage.User(prompt));
  return messages;
}

function resolveRequestTools(context?: LLMContext): vscode.LanguageModelChatTool[] | undefined {
  const requestedToolNames = context?.toolNames?.filter(Boolean);
  if (!requestedToolNames?.length) {
    return undefined;
  }

  const requestedNameSet = new Set(requestedToolNames);
  const matchedTools = vscode.lm.tools
    .filter((tool) => requestedNameSet.has(tool.name))
    .map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));

  const matchedNameSet = new Set(matchedTools.map((tool) => tool.name));
  const missingToolNames = requestedToolNames.filter((name) => !matchedNameSet.has(name));
  if (missingToolNames.length) {
    throw new Error(
      `Requested tools are not registered with VS Code LM: ${missingToolNames.join(', ')}`,
    );
  }

  return matchedTools;
}

class CopilotLLMAdapter implements LLMPort {
  readonly provider = COPILOT_PROVIDER_ID;

  constructor(private readonly config: LLMConfig) {}

  private async resolveModel(): Promise<vscode.LanguageModelChat> {
    const preferredModel = this.config.model?.trim();

    if (!preferredModel) {
      const defaults = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: copilotDescriptor.defaultModel,
      });
      if (defaults.length) {
        return defaults[0];
      }
    }

    if (preferredModel) {
      const exactMatches = await vscode.lm.selectChatModels({ vendor: 'copilot', id: preferredModel });
      if (exactMatches.length) {
        return exactMatches[0];
      }

      const familyMatches = await vscode.lm.selectChatModels({ vendor: 'copilot', family: preferredModel });
      if (familyMatches.length) {
        return familyMatches[0];
      }
    }

    const availableModels = await vscode.lm.selectChatModels({ vendor: 'copilot' });
    if (!availableModels.length) {
      throw new Error(
        'No Copilot models are available. Ensure GitHub Copilot is installed, enabled, and authorized for language model access.',
      );
    }

    if (!preferredModel) {
      return availableModels[0];
    }

    const normalizedPreferred = preferredModel.toLowerCase();
    const matchedModel = availableModels.find((model) =>
      [model.id, model.name, model.family, model.version]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase() === normalizedPreferred),
    );

    if (matchedModel) {
      return matchedModel;
    }

    throw new Error(
      `No Copilot model matched "${preferredModel}". Available models: ${availableModels
        .map((model) => model.name)
        .join(', ')}`,
    );
  }

  private async request(
    prompt: string,
    context?: LLMContext,
  ): Promise<vscode.LanguageModelChatResponse> {
    const model = await this.resolveModel();
    const messages = buildPromptMessages(prompt, context);
    const tools = resolveRequestTools(context);
    const toolMode = context?.toolMode === 'required'
      ? vscode.LanguageModelChatToolMode.Required
      : context?.toolMode === 'auto'
        ? vscode.LanguageModelChatToolMode.Auto
        : undefined;

    try {
      return await model.sendRequest(messages, {
        ...(context?.justification ? { justification: context.justification } : {}),
        ...(tools?.length ? { tools } : {}),
        ...(toolMode ? { toolMode } : {}),
      });
    } catch (error) {
      if (error instanceof vscode.LanguageModelError) {
        throw new Error(`Copilot request failed (${error.code}): ${error.message}`);
      }
      throw error;
    }
  }

  async sendPrompt(prompt: string, context?: LLMContext): Promise<string> {
    const response = await this.request(prompt, context);
    let result = '';
    for await (const chunk of response.text) {
      result += chunk;
    }
    return result;
  }

  async *streamPrompt(prompt: string, context?: LLMContext): AsyncIterable<string> {
    const response = await this.request(prompt, context);
    for await (const chunk of response.text) {
      yield chunk;
    }
  }

  async listAvailableModels(): Promise<LLMModelInfo[]> {
    try {
      const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
      return models.map((model) => ({
        id: model.id,
        displayName: model.name,
        maxInputTokens: model.maxInputTokens,
      }));
    } catch (error) {
      console.error('Failed to list Copilot models:', error);
      return [];
    }
  }
}

export const copilotFactory: LLMProviderFactory = (config) => new CopilotLLMAdapter(config);
