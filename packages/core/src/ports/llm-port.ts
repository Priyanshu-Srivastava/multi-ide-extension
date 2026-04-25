/**
 * LLM abstraction layer for the Omni platform.
 *
 * Design: Open/Closed — core defines the contracts and registry.
 * Adding a new provider (Grok, Gemini, etc.) requires:
 *   1. Implement LLMPort in the relevant adapter package.
 *   2. Call LLMProviderRegistry.register() at adapter activation time.
 *   No changes to @omni/core are ever needed.
 */

// ------------------------------------------------------------------
// Open string type — not a closed union.
// New provider IDs are registered at runtime, not hard-coded here.
// ------------------------------------------------------------------
export type LLMProviderId = string;

export interface LLMConfig {
  /** Registered provider ID, e.g. 'copilot', 'claude', 'grok' */
  provider: LLMProviderId;
  /** Optional API key — not needed for IDE-native providers like Copilot */
  apiKey?: string;
  /** Provider-specific model name override */
  model?: string;
  /** Any additional provider-specific config options */
  options?: Record<string, unknown>;
}

export interface LLMContext {
  systemInstruction?: string;
  /** File paths, editor selections, or other references to inject as context */
  references?: string[];
  /** Optional tool names to make available to the model for this request */
  toolNames?: string[];
  /** Tool-calling strategy for providers that support it */
  toolMode?: 'auto' | 'required';
  /** Human-readable reason for the request, forwarded when supported */
  justification?: string;
}

export interface LLMPort {
  readonly provider: LLMProviderId;
  sendPrompt(prompt: string, context?: LLMContext): Promise<string>;
  streamPrompt?(prompt: string, context?: LLMContext): AsyncIterable<string>;
  /** Optional: list available models for this provider (for UI model selection) */
  listAvailableModels?(): Promise<LLMModelInfo[]>;
}

// ------------------------------------------------------------------
// Model metadata — for UI display and selection
// ------------------------------------------------------------------
export interface LLMModelInfo {
  /** Unique model identifier, e.g. 'gpt-4o', 'claude-3.5-sonnet' */
  id: string;
  /** Display name for UI dropdowns */
  displayName: string;
  /** Context window size in tokens */
  maxInputTokens: number;
  /** Optional capabilities */
  capabilities?: {
    vision: boolean;
    tools: boolean;
    streaming: boolean;
  };
  /** Cost multiplier relative to base model (for UX display) */
  costMultiplier?: number;
}

// ------------------------------------------------------------------
// Provider descriptor — metadata shown in the UI selector
// ------------------------------------------------------------------
export interface LLMProviderDescriptor {
  id: LLMProviderId;
  /** Human-readable label shown in settings dropdowns */
  displayName: string;
  /** Short description shown as tooltip or hint */
  description: string;
  /** Whether this provider requires an API key from the user */
  requiresApiKey: boolean;
  /** Default model for this provider */
  defaultModel?: string;
}

// ------------------------------------------------------------------
// Factory function type — each adapter supplies one per provider
// ------------------------------------------------------------------
export type LLMProviderFactory = (config: LLMConfig) => LLMPort;

// ------------------------------------------------------------------
// Registry — the single source of truth for available providers.
// Adapters call register() at activation time.
// UI and factory code call getAll() / create() — no switch needed.
// ------------------------------------------------------------------
export class LLMProviderRegistry {
  private static readonly _providers = new Map<
    LLMProviderId,
    { descriptor: LLMProviderDescriptor; factory: LLMProviderFactory }
  >();

  /** Register a provider. Typically called in adapter activate(). */
  static register(
    descriptor: LLMProviderDescriptor,
    factory: LLMProviderFactory,
  ): void {
    this._providers.set(descriptor.id, { descriptor, factory });
  }

  /** Returns all registered provider descriptors, sorted by displayName. */
  static getAll(): LLMProviderDescriptor[] {
    return Array.from(this._providers.values())
      .map((e) => e.descriptor)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  /** Returns a single descriptor by ID, or undefined if not registered. */
  static get(id: LLMProviderId): LLMProviderDescriptor | undefined {
    return this._providers.get(id)?.descriptor;
  }

  /** Create an LLMPort instance for the given config. */
  static create(config: LLMConfig): LLMPort {
    const entry = this._providers.get(config.provider);
    if (!entry) {
      throw new Error(
        `LLM provider "${config.provider}" is not registered. ` +
        `Available: [${Array.from(this._providers.keys()).join(', ')}]`,
      );
    }
    return entry.factory(config);
  }

  /** Returns true if the provider ID is registered. */
  static isRegistered(id: LLMProviderId): boolean {
    return this._providers.has(id);
  }
}
