import type { LLMPort, LLMConfig, LLMContext, LLMProviderDescriptor, LLMProviderFactory, LLMModelInfo } from '@omni/core';

export const CLAUDE_PROVIDER_ID = 'claude';

export const claudeDescriptor: LLMProviderDescriptor = {
  id: CLAUDE_PROVIDER_ID,
  displayName: 'Anthropic Claude',
  description: 'Anthropic Claude via REST API. Requires an API key.',
  requiresApiKey: true,
  defaultModel: 'claude-3-5-sonnet-20241022',
};

interface AnthropicResponse {
  content: Array<{ type: string; text: string }>;
  error?: { message: string };
}

class ClaudeLLMAdapter implements LLMPort {
  readonly provider = CLAUDE_PROVIDER_ID;

  constructor(private readonly config: LLMConfig) {
    if (!config.apiKey) {
      throw new Error('Claude provider requires an API key. Set it in Omni settings or VS Code secret storage.');
    }
  }

  async sendPrompt(prompt: string, ctx?: LLMContext): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model ?? claudeDescriptor.defaultModel,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
        ...(ctx?.systemInstruction ? { system: ctx.systemInstruction } : {}),
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Claude API error ${response.status}: ${err}`);
    }

    const data = (await response.json()) as AnthropicResponse;
    const textBlock = data.content.find((b) => b.type === 'text');
    if (!textBlock) throw new Error('Claude returned no text content.');
    return textBlock.text;
  }

  async *streamPrompt(prompt: string, ctx?: LLMContext): AsyncIterable<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model ?? claudeDescriptor.defaultModel,
        max_tokens: 2048,
        stream: true,
        messages: [{ role: 'user', content: prompt }],
        ...(ctx?.systemInstruction ? { system: ctx.systemInstruction } : {}),
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Claude streaming error ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value).split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const json = line.slice(6).trim();
        if (json === '[DONE]') return;
        try {
          const event = JSON.parse(json) as { type: string; delta?: { type: string; text: string } };
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            yield event.delta.text;
          }
        } catch {
          // skip malformed SSE lines
        }
      }
    }
  }

  async listAvailableModels(): Promise<LLMModelInfo[]> {
    // Claude models are known at compile time (REST API has no model list endpoint)
    return [
      {
        id: 'claude-3-5-sonnet-20241022',
        displayName: 'Claude 3.5 Sonnet',
        maxInputTokens: 200000,
        capabilities: { vision: true, tools: true, streaming: true },
        costMultiplier: 1,
      },
      {
        id: 'claude-3-opus-20250219',
        displayName: 'Claude 3 Opus',
        maxInputTokens: 200000,
        capabilities: { vision: true, tools: true, streaming: true },
        costMultiplier: 1.5,
      },
      {
        id: 'claude-3-haiku-20240307',
        displayName: 'Claude 3 Haiku',
        maxInputTokens: 200000,
        capabilities: { vision: true, tools: true, streaming: true },
        costMultiplier: 0.3,
      },
    ];
  }
}

export const claudeFactory: LLMProviderFactory = (config) => new ClaudeLLMAdapter(config);
