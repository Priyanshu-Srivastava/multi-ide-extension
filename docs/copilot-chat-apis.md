# Copilot Chat APIs — Comprehensive Analysis

## Overview
This document catalogs all GitHub Copilot Chat APIs available across VS Code, Cursor, and JetBrains IDEs.

---

## 1. VS Code Language Model API (`vscode.lm`)

### 1.1 `selectChatModels(selector?): Promise<LanguageModelChat[]>`

**Purpose:** Discover and select available language models based on criteria.

**Parameters:**
```ts
interface LanguageModelChatSelector {
  vendor?: string;    // e.g., 'copilot'
  family?: string;    // e.g., 'gpt-4o', 'gpt-4o-mini', 'o1', 'claude-3.5-sonnet'
  id?: string;        // specific model ID
  version?: string;   // model version
}
```

**Returns:**
```ts
LanguageModelChat[]
// Each model contains:
{
  vendor: string;              // 'copilot'
  id: string;                  // unique model identifier
  family: string;              // model family name
  name: string;                // display name
  version: string;             // model version
  maxInputTokens: number;      // token limit for input (e.g., 64000 for gpt-4o)
  maxOutputTokens: number;     // max tokens for output
  capabilities: {
    imageInput?: boolean;      // supports image inputs
    toolCalling?: boolean | number; // tool/function calling support
  }
}
```

**Errors:**
- `vscode.LanguageModelError.NotFound` — model doesn't exist
- `vscode.LanguageModelError.NoPermissions` — user didn't grant consent
- `vscode.LanguageModelError.Blocked` — request blocked (e.g., content policy)

**Key Notes:**
- Must be called in response to user-initiated action (e.g., command, click)
- Default recommendation: `gpt-4o` for quality, `gpt-4o-mini` for speed/cost
- Supports streaming models

---

### 1.2 `LanguageModelChat.sendRequest(messages, options?, token?): Promise<LanguageModelChatResponse>`

**Purpose:** Send a chat request to a language model and receive a streaming response.

**Parameters:**

```ts
// Messages
interface LanguageModelChatMessage {
  role: 'user' | 'assistant';
  content: string | LanguageModelInputPart[];
  name?: string;
}

// Input parts (rich content)
type LanguageModelInputPart = 
  | LanguageModelTextPart
  | LanguageModelDataPart (Uint8Array for images, JSON, etc.)
  | LanguageModelToolResultPart
  | LanguageModelToolCallPart;

// Request options
interface LanguageModelChatRequestOptions {
  justification?: string;      // why this request is needed (for logging)
  modelOptions?: {
    temperature?: number;      // 0.0-2.0 (default: varies by model)
    topP?: number;            // 0.0-1.0
    frequencyPenalty?: number; // -2.0 to 2.0
    presencePenalty?: number;  // -2.0 to 2.0
  };
  toolMode?: LanguageModelChatToolMode;  // 'auto' | 'required'
  tools?: LanguageModelChatTool[];       // available functions
}

// Tool definition
interface LanguageModelChatTool {
  name: string;
  description: string;
  inputSchema?: object;  // JSON Schema
}
```

**Returns:**
```ts
interface LanguageModelChatResponse {
  text: AsyncIterable<string>;       // stream of text chunks
  stream: AsyncIterable<unknown>;    // raw response parts (includes tool calls)
}
```

**Errors:**
- Same as `selectChatModels` + network/quota errors
- Can fail mid-stream

**Key Notes:**
- Streaming-based (no waiting for full response)
- Supports tool/function calling
- Token counting available via `countTokens(text)` on model instance
- Rate limiting enforced per extension/user

---

### 1.3 `countTokens(text | message, token?): Promise<number>`

**Purpose:** Count tokens for a prompt/message to stay within `maxInputTokens` limits.

**Returns:** Token count (integer)

**Behavior:**
- Can be called on any `LanguageModelChat` instance
- Async operation
- Essential before sending large prompts

---

## 2. Cursor IDE (VS Code Fork)

### Inheritance & Differences

**Base:** Cursor is a fork of VS Code, so it **fully supports** `vscode.lm` API.

**Differences:**
- **Provider:** Uses Cursor's own AI models by default, NOT GitHub Copilot
- **Model Family:** Cursor AI models (proprietary, not named in public docs)
- **Copilot Support:** GitHub Copilot plugin CAN be installed but is optional
- **API:** Identical to VS Code `vscode.lm` — same method signatures

### Recommended Approach

```ts
// In Cursor adapter, same as VS Code:
const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });

// If empty array, Copilot not installed/enabled in Cursor
// Fall back to Cursor's native AI via `vscode.lm` with no vendor specified:
if (models.length === 0) {
  const cursorModels = await vscode.lm.selectChatModels({});
}
```

---

## 3. JetBrains IDEs (IntelliJ IDEA, PyCharm, WebStorm, etc.)

### 3.1 AI Services API (Native)

**Location:** `com.intellij.openapi.application.ex.ApplicationManagerEx`

JetBrains provides its own **AI Services** framework:

```java
// Get AI service instance
AIService aiService = ApplicationManager.getApplication()
  .getService(AIService.class);

// Send request
AIRequest request = new AIRequest(
  prompt,
  model,      // model ID
  temperature // 0.0-1.0
);

CompletableFuture<AIResponse> response = aiService.sendRequest(request);

// Handle response
response.thenAccept(resp -> {
  String content = resp.getContent();
  int tokenUsage = resp.getTokenUsage();
  // ...
});
```

**Available Models (JetBrains AI):**
- `gpt-4o` (OpenAI via JetBrains partnership)
- `claude-3-opus` (Anthropic)
- Local models (if configured)

**Parameters:**
- `prompt`: String
- `model`: String (model identifier)
- `temperature`: Double (0.0–1.0)
- `maxTokens`: Int (optional)
- `stopSequences`: List<String> (optional)
- `systemPrompt`: String (optional)

**Returns:**
```java
class AIResponse {
  String getContent();           // generated text
  int getTokenUsage();           // tokens used
  String getModel();             // model used
  boolean isStreamable();        // supports streaming
  Stream<String> getStream();    // for streaming responses
}
```

**Error Handling:**
- `AIServiceException` — service not available or error
- `AIQuotaExceededException` — rate limit exceeded
- `AIAuthException` — auth failed

---

### 3.2 GitHub Copilot Plugin API (for JetBrains)

**Note:** GitHub Copilot is an **optional plugin** in JetBrains, not built-in.

**When installed**, Copilot provides:

```java
// Access Copilot service
CopilotService copilot = project.getService(CopilotService.class);

// Send chat request
CopilotChatRequest request = new CopilotChatRequest(
  prompt,
  conversationId,  // optional
  model            // defaults to gpt-4o
);

CompletableFuture<String> response = copilot.chat(request);
```

**Available Models:**
- `gpt-4o` (default)
- `gpt-4-turbo`
- `gpt-3.5-turbo`

**Parameters & Return Type:** Similar to AI Services

**Challenges:**
- **Optional Dependency:** Plugin may not be installed
- **Single Model Focus:** Less flexibility than VS Code
- **No Streaming:** Returns full response only

**Detection:**
```java
PluginDescriptor copilotPlugin = PluginManager.getPluginByClassName(
  "com.github.copilot.CopilotService"
);
boolean copilotAvailable = copilotPlugin != null && copilotPlugin.isEnabled();
```

---

## 4. Comparative Feature Matrix

| Feature | VS Code / Cursor | JetBrains AI | JetBrains Copilot |
|---------|------------------|--------------|-------------------|
| **Model Selection** | ✅ Flexible (vendor, family, id) | ✅ By ID | ⚠️ Fixed list |
| **Streaming** | ✅ AsyncIterable | ✅ Stream<String> | ❌ No |
| **Tool Calling** | ✅ Yes | ⚠️ Manual | ❌ No |
| **Temperature Control** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Token Counting** | ✅ Built-in | ⚠️ Manual | ⚠️ Manual |
| **Error Types** | ✅ Typed (LanguageModelError) | ✅ Typed (AIServiceException) | ⚠️ Generic Exception |
| **Built-in** | ✅ Yes (VS Code) / ⚠️ Cursor-native only | ✅ Yes | ❌ Optional plugin |
| **Auth** | IDE-native | IDE-native | GitHub-native |
| **Rate Limiting** | ✅ Per-user quota | ✅ Per-user quota | ✅ Per-user quota |

---

## 5. Default Model Recommendations

Based on cost, quality, and latency:

| Use Case | VS Code / Cursor | JetBrains |
|----------|-----------------|-----------|
| **High Quality** | `gpt-4o` | `gpt-4o` |
| **Fast / Cost-Optimized** | `gpt-4o-mini` | Use jb-config |
| **Long Context** | `gpt-4o` (64K tokens) | `gpt-4o` (128K) |
| **Auto (User Choice)** | **Recommended:** Let user select in settings | **Recommended:** Read from IDE config |

---

## 6. Implementation Strategy

### Model Usage Configuration

**VS Code/Cursor:**
```ts
// settings.json
{
  "omni.llm.copilot.model": "auto",  // "auto" | "gpt-4o" | "gpt-4o-mini" | "o1-mini"
  "omni.llm.copilot.temperature": "auto"  // "auto" | 0.0-1.0
}
```

**JetBrains:**
```java
// IDE Settings → AI Services → Provider Settings
// Or via code:
AISettings settings = AISettings.getInstance();
String modelChoice = settings.getModel();  // "auto" or model ID
double temperature = settings.getTemperature();
```

### "Auto" Mode Behavior

**Definition:** Let the **IDE** or **user's configured default** choose the model.

**Implementation:**
1. If user selected "auto", don't pass `family` to `selectChatModels()` — the IDE will pick its default
2. For JetBrains, read from IDE AI preferences
3. Log which model was actually selected for transparency

---

## 7. Error Handling Strategy

| Error | VS Code | Cursor | JetBrains |
|-------|---------|--------|-----------|
| **No consent** | `LanguageModelError.NoPermissions` | `LanguageModelError.NoPermissions` | `AIAuthException` |
| **Model unavailable** | `LanguageModelError.NotFound` | `LanguageModelError.NotFound` | Check plugin/service |
| **Rate limited** | `LanguageModelError` + cause | `LanguageModelError` + cause | `AIQuotaExceededException` |
| **Content policy** | `LanguageModelError.Blocked` | `LanguageModelError.Blocked` | Varies by provider |

**Best Practice:** Wrap all calls in try-catch, show user-friendly messages, never expose raw errors.

---

## 8. Implementation Phasing

### Phase 1: VS Code / Cursor
- Use `vscode.lm` API
- Support `gpt-4o`, `gpt-4o-mini`, `o1-mini`
- Default: `auto` (IDE decides)
- Streaming enabled

### Phase 2: JetBrains
- Detect AI Services availability
- Detect Copilot plugin (if installed)
- Prefer AI Services (always available)
- Fall back to Copilot if needed
- Model: default to `gpt-4o`

### Phase 3: Extension Support
- Make model registry extensible
- Allow teams to register custom models
- Support dynamic provider discovery

---

## 9. Token Budget & Cost Management

### Limits

| Model | Max Input | Max Output | Recommendation |
|-------|-----------|------------|-----------------|
| gpt-4o | 128,000 | 4,096 | Use for complex tasks |
| gpt-4o-mini | 128,000 | 4,096 | Default for UI speed |
| o1-mini | 128,000 | 65,536 | Reasoning tasks |
| claude-3.5-sonnet | 200,000 | 4,096 | Long context |

### Strategy
1. **Before sending:** Call `countTokens()` on message
2. **If over budget:** Truncate context or show warning
3. **Log usage:** Track per-team, per-user for billing
4. **Default:** Use "Auto" to let IDE optimize

---

## 10. Testing & Validation

### Mock Data

For testing without real API calls:

```ts
// Mock LanguageModelChat
class MockCopilotModel implements LanguageModelChat {
  sendRequest() {
    return Promise.resolve({
      text: (async function* () {
        yield "Hello, world!";
      })()
    });
  }
  countTokens() {
    return Promise.resolve(42);
  }
}
```

### Unit Test Examples

```ts
it('should handle model selection failure gracefully', async () => {
  vscode.lm.selectChatModels = jest.fn().mockResolvedValueOnce([]);
  
  const result = await copilotService.sendPrompt("test");
  expect(result).toContain("No model available");
});

it('should respect user model choice', async () => {
  config.model = "gpt-4o-mini";
  const model = await copilotService.selectModel();
  expect(model.family).toBe("gpt-4o-mini");
});
```

---

## 11. References

- **VS Code Language Model API:** https://code.visualstudio.com/api/extension-guides/language-model
- **VS Code API Reference:** https://code.visualstudio.com/api/references/vscode-api#lm
- **JetBrains AI Services:** https://plugins.jetbrains.com/docs/intellij/ai-services.html
- **Cursor Documentation:** https://docs.cursor.sh
