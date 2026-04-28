# Contract: JetBrains Sidecar HTTP Bridge Transport

**Contract ID**: `transport-jetbrains`  
**Version**: 1.0.0  
**Owner**: controller-pod  
**Applies to**: `packages/adapters/jetbrains/`  
**Transport type**: stdio (local Docker container) via HTTP bridge  

---

## Overview

JetBrains cannot use VS Code extension APIs, so it uses a sidecar HTTP bridge pattern. A lightweight JSON-RPC HTTP server runs on `OMNI_SIDECAR_PORT` (default 7654). When the JetBrains plugin sends a `POST /rpc` request, the bridge translates it into a JSON-RPC 2.0 `tools/call` to a locally running GitHub MCP server process (Docker container), then returns the response.

```
JetBrains Plugin
     │  POST /rpc (SidecarRequest)
     ▼
Sidecar HTTP Server (port 7654)
     │  JetBrainsSidecarBridge(request)
     ▼
JetBrainsSidecarBridge (SidecarTransport)
     │  stdin  JSON-RPC 2.0
     ▼
Docker: ghcr.io/github/github-mcp-server:v1.0.3
     │  stdout  JSON-RPC 2.0 response
     ▼
JetBrainsSidecarBridge (parses response)
     │  SidecarResponse
     ▼
Sidecar HTTP Server (returns response body)
     │  HTTP 200 + JSON
     ▼
JetBrains Plugin
```

---

## `JetBrainsSidecarBridge` Interface

Implements `SidecarTransport` from `packages/core/src/rpc/index.ts`:

```typescript
type SidecarTransport = (request: SidecarRequest) => Promise<SidecarResponse>;

// Export from packages/adapters/jetbrains/src/index.ts:
export const JetBrainsSidecarBridge: SidecarTransport;
```

The current stub implementation in `packages/adapters/jetbrains/src/index.ts` returns:
```typescript
{ acknowledged: true, method: request.method }  // STUB — to be replaced
```

This contract specifies the production implementation.

---

## Production Implementation Specification

### Process Lifecycle

```typescript
// packages/adapters/jetbrains/src/bridge.ts

import { spawn, ChildProcess } from 'child_process';
import type { SidecarTransport, SidecarRequest, SidecarResponse } from '@omni/core';

const CALL_TIMEOUT_MS = 30_000;
const DOCKER_IMAGE = 'ghcr.io/github/github-mcp-server:v1.0.3';

let childProcess: ChildProcess | null = null;
let callIdCounter = 1;
let initialized = false;

async function ensureProcess(): Promise<ChildProcess> {
  if (childProcess && !childProcess.killed) return childProcess;
  return spawnMCPServer();
}

async function spawnMCPServer(): Promise<ChildProcess> {
  const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  if (!token) {
    throw new Error('GITHUB_PERSONAL_ACCESS_TOKEN is not set');
  }

  childProcess = spawn('docker', [
    'run', '-i', '--rm',
    '-e', 'GITHUB_PERSONAL_ACCESS_TOKEN',
    DOCKER_IMAGE,
    '--toolsets=pull_requests,context',
  ], {
    env: { ...process.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Perform MCP initialize handshake
  await initialize(childProcess);
  initialized = true;
  return childProcess;
}
```

### MCP Initialization Handshake

When the process starts, the GitHub MCP server (following MCP protocol) requires an `initialize` request before `tools/call` requests are accepted:

```typescript
async function initialize(proc: ChildProcess): Promise<void> {
  const initRequest = {
    jsonrpc: '2.0',
    id: 0,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'omni-jetbrains-bridge', version: '1.0.0' },
    },
  };

  proc.stdin!.write(JSON.stringify(initRequest) + '\n');
  // Read and discard the initialize response
  await readNextLine(proc.stdout!);

  // Send initialized notification
  proc.stdin!.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
}
```

### RPC Call

```typescript
export const JetBrainsSidecarBridge: SidecarTransport = async (
  request: SidecarRequest
): Promise<SidecarResponse> => {
  let proc: ChildProcess;
  try {
    proc = await ensureProcess();
  } catch (err) {
    return { acknowledged: false, error: String(err) };
  }

  const id = callIdCounter++;
  const rpcRequest = {
    jsonrpc: '2.0',
    id,
    method: request.method,       // e.g. "tools/call"
    params: request.params,
  };

  proc.stdin!.write(JSON.stringify(rpcRequest) + '\n');

  try {
    const line = await readNextLineWithTimeout(proc.stdout!, CALL_TIMEOUT_MS);
    const parsed = JSON.parse(line);

    if (parsed.error) {
      return { acknowledged: false, error: parsed.error.message ?? JSON.stringify(parsed.error) };
    }

    return { acknowledged: true, result: parsed.result };
  } catch (err) {
    if (String(err).includes('timed out')) {
      return { acknowledged: false, error: `GitHub MCP call timed out after ${CALL_TIMEOUT_MS / 1000}s` };
    }
    // Process may have crashed — attempt one restart
    childProcess = null;
    initialized = false;
    return { acknowledged: false, error: `GitHub MCP process error: ${String(err)}` };
  }
};
```

### `readNextLineWithTimeout` Helper

```typescript
function readNextLineWithTimeout(stream: NodeJS.ReadableStream, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out')), timeoutMs);

    let buffer = '';
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      const newlineIdx = buffer.indexOf('\n');
      if (newlineIdx !== -1) {
        clearTimeout(timer);
        stream.removeListener('data', onData);
        resolve(buffer.substring(0, newlineIdx));
      }
    };
    stream.on('data', onData);
  });
}
```

---

## Sidecar HTTP Server Routes

Defined in `packages/adapters/jetbrains/src/activate.ts`:

### `POST /rpc`

**Request body**: `SidecarRequest` JSON  
**Response body**: `SidecarResponse` JSON  
**HTTP status**: Always `200` (error information is in `SidecarResponse.error`)

```typescript
app.post('/rpc', async (req, res) => {
  const body: SidecarRequest = req.body;
  const response = await JetBrainsSidecarBridge(body);
  res.json(response);
});
```

**Example request**:
```json
{
  "method": "tools/call",
  "params": {
    "name": "pull_request_read",
    "arguments": {
      "method": "get",
      "owner": "acme-corp",
      "repo": "backend-api",
      "pullNumber": 42
    }
  }
}
```

**Example response (success)**:
```json
{
  "acknowledged": true,
  "result": {
    "content": [{ "type": "text", "text": "{\"number\":42,\"title\":\"Add auth\",...}" }],
    "isError": false
  }
}
```

**Example response (error)**:
```json
{
  "acknowledged": false,
  "error": "GitHub MCP call timed out after 30s"
}
```

### `GET /health`

Returns the list of registered tools from `MCPRegistry`.

**Response body**:
```json
{
  "status": "ok",
  "tools": [
    { "toolId": "github.pull_request_read", "displayName": "GitHub PR Read", "enabled": true },
    { "toolId": "github.pull_request_review_write", "displayName": "GitHub PR Review Write", "enabled": true }
  ]
}
```

---

## Authentication

JetBrains bridge uses **environment variable only** for credentials:

```
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Minimum required scopes**: `repo`  
**Recommended token type**: Classic PAT (`ghp_` prefix) — fine-grained PATs may not filter tools correctly.

The Docker container receives the token via `-e GITHUB_PERSONAL_ACCESS_TOKEN` in the `docker run` command. The value is read from the `activate.ts` Node.js process environment, which inherits from the JetBrains IDE launch environment.

**Security note**: The token is never logged, never written to disk, and never returned in API responses. The sidecar HTTP server MUST NOT expose `/health` responses containing token values.

---

## Error Conditions

| Condition | Handling |
| --------- | -------- |
| `GITHUB_PERSONAL_ACCESS_TOKEN` not set | `spawnMCPServer` throws; bridge returns `{ acknowledged: false, error: "GITHUB_PERSONAL_ACCESS_TOKEN is not set" }` |
| Docker not installed | `spawn` fails with ENOENT; bridge returns `{ acknowledged: false, error: "docker: command not found" }` |
| Docker image not found locally | First-call latency during pull (~30–120s); if pull exceeds timeout, returns timeout error. Image pull should be documented as a prerequisite step. |
| Call timeout (30s) | `{ acknowledged: false, error: "GitHub MCP call timed out after 30s" }` |
| Child process crashes | Attempt one restart; if restart fails within 10s, return `{ acknowledged: false, error: "GitHub MCP process unavailable" }` |
| Port 7654 in use | Sidecar HTTP server logs error and exits; IDE must set `OMNI_SIDECAR_PORT` to a free port |
| Invalid JSON from child process stdout | `{ acknowledged: false, error: "GitHub MCP response parse error: ..." }` |
| GitHub token expired / 401 | GitHub MCP server returns error in JSON-RPC response; bridge returns `{ acknowledged: false, error: "GitHub authentication failed: ..." }` |

---

## Registry Registration (JetBrains activation)

```typescript
// packages/adapters/jetbrains/src/activate.ts

import { JetBrainsSidecarBridge } from './index';
import { ExternalMCPToolAdapter, MCPRegistry } from '@omni/mcp';

const registry = MCPRegistry.getInstance();

registry.register(new ExternalMCPToolAdapter({
  toolId: 'github.pull_request_read',
  displayName: 'GitHub PR Read',
  teamId: 'controller-pod',
  transport: JetBrainsSidecarBridge,
}));

registry.register(new ExternalMCPToolAdapter({
  toolId: 'github.list_pull_requests',
  displayName: 'GitHub List Pull Requests',
  teamId: 'controller-pod',
  transport: JetBrainsSidecarBridge,
}));

registry.register(new ExternalMCPToolAdapter({
  toolId: 'github.pull_request_review_write',
  displayName: 'GitHub PR Review Write',
  teamId: 'controller-pod',
  transport: JetBrainsSidecarBridge,
}));

registry.register(new ExternalMCPToolAdapter({
  toolId: 'github.add_comment_to_pending_review',
  displayName: 'GitHub Add Comment to Pending Review',
  teamId: 'controller-pod',
  transport: JetBrainsSidecarBridge,
}));
```

All four tools share the same `JetBrainsSidecarBridge` instance. The bridge multiplexes calls over the single persistent Docker process.
