/**
 * LLM provider registrations for the VS Code / Cursor adapter.
 *
 * To add a new provider:
 *   1. Create <provider>-llm-adapter.ts in this folder.
 *   2. Export a descriptor and factory from it.
 *   3. Add a single registerLLMProvider() call below.
 *   4. No changes to @omni/core or any other package are needed.
 */
import { LLMProviderRegistry } from '@omni/core';
import { copilotDescriptor, copilotFactory } from './copilot-llm-adapter';
import { claudeDescriptor, claudeFactory } from './claude-llm-adapter';

export function registerLLMProviders(): void {
  LLMProviderRegistry.register(copilotDescriptor, copilotFactory);
  LLMProviderRegistry.register(claudeDescriptor, claudeFactory);
}

export { LLMProviderRegistry } from '@omni/core';
export type { LLMPort, LLMConfig, LLMContext, LLMProviderId } from '@omni/core';
