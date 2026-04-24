# MCP Tools

## What is MCP?

**Model Context Protocol (MCP)** is an open standard for connecting AI agents (Copilot, Claude, GPT-4, etc.) to tools and data sources. In Omni, MCP tools are callable by any AI agent at runtime during a task — the agent can read files, run commands, inspect diagnostics, and more, all through a uniform tool interface.

---

## Tool Architecture

All MCP tools in this project are **project-global**. No single team owns a tool. Any team's feature code or any IDE adapter can call any registered tool via `MCPRegistry`.

```
MCPRegistry (global singleton per adapter activate())
├── WorkspaceReadFileTool      (built-in VS Code API)
├── WorkspaceFindFilesTool     (built-in VS Code API)
├── WorkspaceWriteFileTool     (built-in VS Code API)
├── WorkspaceListDirectoryTool (built-in VS Code API)
├── GetDiagnosticsTool         (built-in VS Code API)
├── ExecuteCommandTool         (built-in VS Code API)
├── GetActiveEditorTool        (built-in VS Code API)
├── GitStatusTool              (built-in vscode.git extension API)
└── ExternalMCPToolAdapter     (wraps external MCP server, e.g. github-search)
```

---

## Built-in VS Code Tools

All 8 tools live in `packages/adapters/vscode/src/mcp-tools/vscode/`.

### `vscode.workspace.readFile`

Reads the full text content of any file in the workspace.

```typescript
input.method = 'readFile'
input.params = {
  uri: '/absolute/path/to/file.ts'  // or file:// URI
}

// Returns
{
  uri: 'file:///absolute/path/to/file.ts',
  content: '...',
  languageId: 'typescript',
  lineCount: 42
}
```

---

### `vscode.workspace.findFiles`

Searches workspace files with glob patterns.

```typescript
input.method = 'findFiles'
input.params = {
  include: '**/*.ts',                   // required
  exclude: '**/node_modules/**',        // optional, default: node_modules excluded
  maxResults: 50                        // optional, default: 100
}

// Returns
{
  files: ['/abs/path/src/index.ts', '/abs/path/src/app.ts']
}
```

---

### `vscode.workspace.writeFile`

Writes (creates or overwrites) a file.

```typescript
input.method = 'writeFile'
input.params = {
  uri: '/path/to/output.json',
  content: '{ "hello": "world" }'
}

// Returns
{ uri: 'file:///path/to/output.json' }
```

---

### `vscode.workspace.listDirectory`

Lists entries inside a directory.

```typescript
input.method = 'listDirectory'
input.params = {
  uri: '/path/to/src'
}

// Returns
{
  entries: [
    { name: 'index.ts', type: 'File' },
    { name: 'features', type: 'Directory' }
  ]
}
```

---

### `vscode.languages.getDiagnostics`

Returns errors, warnings, and hints from the language server.

```typescript
input.method = 'getDiagnostics'
input.params = {
  uri: '/path/to/file.ts'  // optional — omit for ALL files
}

// Returns
{
  diagnostics: [
    {
      uri: 'file:///path/to/file.ts',
      severity: 'Error',           // 'Error' | 'Warning' | 'Information' | 'Hint'
      message: "Cannot find name 'foo'",
      range: { start: { line: 4, character: 2 }, end: { line: 4, character: 5 } },
      source: 'ts',
      code: 2304
    }
  ]
}
```

---

### `vscode.commands.executeCommand`

Executes any registered VS Code command (built-in or extension-contributed).

```typescript
input.method = 'executeCommand'
input.params = {
  command: 'editor.action.formatDocument',
  args: []
}

// Returns
{ result: null }   // raw return value of the command
```

Common built-in commands:
- `editor.action.formatDocument` — Format the active file
- `workbench.action.reloadWindow` — Reload VS Code window
- `git.push` — Git push
- `workbench.action.files.save` — Save current file

---

### `vscode.window.getActiveEditor`

Returns information about the currently focused editor.

```typescript
input.method = 'getActiveEditor'
// No params needed

// Returns (editor open)
{
  active: true,
  uri: 'file:///src/index.ts',
  languageId: 'typescript',
  lineCount: 100,
  isDirty: false,
  cursor: { line: 12, character: 5 },
  selection: {         // null if no text selected
    start: { line: 10, character: 0 },
    end: { line: 14, character: 3 },
    selectedText: 'export function...'
  }
}

// Returns (no editor open)
{ active: false }
```

---

### `vscode.git.status`

Returns the git repository status via the built-in `vscode.git` extension.

```typescript
input.method = 'status'
input.params = {
  repoPath: '/optional/override/path'   // defaults to first workspace folder
}

// Returns
{
  repoRoot: '/path/to/repo',
  HEAD: { name: 'main', commit: 'abc123', type: 'Head' },
  workingTreeChanges: [
    { uri: '/path/to/modified.ts', status: 'MODIFIED' }
  ],
  indexChanges: [
    { uri: '/path/to/staged.ts', status: 'INDEX_MODIFIED' }
  ],
  mergeChanges: []
}
```

Status values: `MODIFIED`, `DELETED`, `UNTRACKED`, `IGNORED`, `INDEX_MODIFIED`, `INDEX_ADDED`, `INDEX_DELETED`, `INDEX_RENAMED`, `BOTH_MODIFIED`, etc.

---

## Configuration

Tools are enabled/disabled via `packages/mcp/mcp.config.json`:

```json
{
  "version": "1",
  "tools": [
    { "toolId": "vscode.workspace.readFile",    "enabled": true },
    { "toolId": "vscode.workspace.findFiles",   "enabled": true },
    { "toolId": "vscode.workspace.writeFile",   "enabled": true },
    { "toolId": "vscode.workspace.listDirectory","enabled": true },
    { "toolId": "vscode.languages.getDiagnostics","enabled": true },
    { "toolId": "vscode.commands.executeCommand","enabled": true },
    { "toolId": "vscode.window.getActiveEditor","enabled": true },
    { "toolId": "vscode.git.status",            "enabled": true }
  ]
}
```

A tool not listed in config is treated as **disabled**. The registry returns an error result without calling `tool.execute()`.

### Runtime config update

Config can be updated at runtime without restarting the extension:

```typescript
registry.updateConfig(newConfig);
```

---

## Adding a New Built-in Tool

1. Create the implementation in `packages/adapters/vscode/src/mcp-tools/vscode/my-tool.ts`:

```typescript
import * as vscode from 'vscode';
import { MCPToolPort, MCPToolInput, MCPToolResult } from '@omni/core';

export class MyTool implements MCPToolPort {
  readonly toolId = 'vscode.my.toolId';
  readonly displayName = 'VS Code: My Tool';

  async execute(input: MCPToolInput): Promise<MCPToolResult> {
    if (input.method !== 'myMethod') {
      return { success: false, error: `Unknown method: ${input.method}` };
    }
    // ... implementation
    return { success: true, data: { result: '...' } };
  }
}
```

2. Export from `packages/adapters/vscode/src/mcp-tools/vscode/index.ts`:

```typescript
export { MyTool } from './my-tool';
```

3. Register in `packages/adapters/vscode/src/activate.ts`:

```typescript
registry.register(new MyTool());
```

4. Add to `packages/mcp/mcp.config.json`:

```json
{ "toolId": "vscode.my.toolId", "enabled": true }
```

---

## Using an External MCP Server

For tools from an external MCP server (e.g. `@modelcontextprotocol/server-github`):

```typescript
import { ExternalMCPToolAdapter } from '@omni/mcp';

const githubTransport: SidecarTransport = async (req) => {
  // call the external server's JSON-RPC endpoint
};

registry.register(new ExternalMCPToolAdapter({
  toolId: 'github.search',
  displayName: 'GitHub: Search Code',
  transport: githubTransport,
}));
```

The external server runs as a separate process. `ExternalMCPToolAdapter` wraps its transport and presents it to `MCPRegistry` as a normal tool. See [architecture.md](architecture.md) for the full pattern.

---

## Listing Registered Tools

```typescript
const tools = registry.listTools();
// [
//   { toolId: 'vscode.workspace.readFile', displayName: '...', enabled: true },
//   { toolId: 'vscode.git.status',         displayName: '...', enabled: false },
// ]
```

Use the `omni.<team>.listTools` VS Code command (accessible from the Command Palette) to see the same list at runtime.
