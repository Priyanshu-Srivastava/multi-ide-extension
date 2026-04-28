# Contract: VS Code / Cursor Transport Wiring

**Contract ID**: `transport-vscode`  
**Version**: 1.0.0  
**Owner**: controller-pod  
**Applies to**: `packages/adapters/vscode/`, `packages/adapters/cursor/`  
**Transport type**: HTTP remote  

---

## Overview

VS Code and Cursor use an HTTP transport to the GitHub MCP remote server at `https://api.githubcopilot.com/mcp/`. Authentication is via VS Code OAuth (primary) or GitHub PAT (fallback). Cursor inherits VS Code adapter behaviour without a separate implementation.

---

## Transport Function Signature

All transports implement `SidecarTransport` from `packages/core/src/rpc/index.ts`:

```typescript
type SidecarTransport = (request: SidecarRequest) => Promise<SidecarResponse>;
```

Where:

```typescript
interface SidecarRequest {
  method: string;      // e.g. "tools/call"
  params?: unknown;    // JSON-RPC params
  id?: string | number;
}

interface SidecarResponse {
  result?: unknown;    // parsed response data
  error?: string;      // error message if the call failed
  acknowledged: boolean;
}
```

---

## Read Transport (read-only tools)

Used for: `github.pull_request_read`, `github.list_pull_requests`

```typescript
// packages/adapters/vscode/src/transports/github-read-transport.ts

import * as vscode from 'vscode';
import type { SidecarTransport, SidecarRequest, SidecarResponse } from '@omni/core';

const GITHUB_MCP_URL = 'https://api.githubcopilot.com/mcp/';

export function createGitHubReadTransport(token: string): SidecarTransport {
  return async (request: SidecarRequest): Promise<SidecarResponse> => {
    const body = {
      jsonrpc: '2.0',
      id: request.id ?? Date.now(),
      method: request.method,
      params: request.params,
    };

    const response = await fetch(GITHUB_MCP_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-MCP-Toolsets': 'pull_requests,context',
        'X-MCP-Readonly': 'true',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return {
        acknowledged: false,
        error: `GitHub MCP HTTP error: ${response.status} ${response.statusText}`,
      };
    }

    const json = await response.json();
    return {
      acknowledged: true,
      result: json.result ?? json,
    };
  };
}
```

---

## Write Transport (write tools)

Used for: `github.pull_request_review_write`, `github.add_comment_to_pending_review`

Identical to read transport **without** `X-MCP-Readonly` header:

```typescript
export function createGitHubWriteTransport(token: string): SidecarTransport {
  return async (request: SidecarRequest): Promise<SidecarResponse> => {
    const body = { jsonrpc: '2.0', id: request.id ?? Date.now(), method: request.method, params: request.params };
    const response = await fetch(GITHUB_MCP_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-MCP-Toolsets': 'pull_requests,context',
        // No X-MCP-Readonly header
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      return { acknowledged: false, error: `GitHub MCP HTTP error: ${response.status}` };
    }
    const json = await response.json();
    return { acknowledged: true, result: json.result ?? json };
  };
}
```

---

## Authentication Flow

### Primary: VS Code OAuth

```typescript
// In packages/adapters/vscode/src/activate.ts

async function getGitHubToken(): Promise<string | null> {
  try {
    const session = await vscode.authentication.getSession(
      'github',
      ['repo'],   // required scope for PR read and write
      { createIfNone: true }
    );
    return session.accessToken;
  } catch {
    return null;
  }
}
```

**Behaviour**:
- VS Code 1.101+: Triggers OAuth popup if no existing session.
- If user cancels: returns `null`; adapter skips GitHub tool registration.
- Token refresh: VS Code manages token lifecycle automatically.

### Fallback: GitHub PAT

```typescript
async function getGitHubToken(): Promise<string | null> {
  // 1. Try VS Code OAuth
  const oauthToken = await tryVSCodeOAuth();
  if (oauthToken) return oauthToken;

  // 2. Fall back to environment variable
  const pat = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  if (pat) return pat;

  // 3. No token available
  return null;
}
```

**PAT requirements**: Minimum scope `repo`. Classic PAT (`ghp_` prefix) preferred for predictable scope filtering by GitHub MCP server.

---

## Registry Registration (VS Code activation)

```typescript
// In packages/adapters/vscode/src/activate.ts

const token = await getGitHubToken();

if (token) {
  const readTransport = createGitHubReadTransport(token);
  const writeTransport = createGitHubWriteTransport(token);

  registry.register(new ExternalMCPToolAdapter({
    toolId: 'github.pull_request_read',
    displayName: 'GitHub PR Read',
    teamId: 'controller-pod',
    transport: readTransport,
  }));

  registry.register(new ExternalMCPToolAdapter({
    toolId: 'github.list_pull_requests',
    displayName: 'GitHub List Pull Requests',
    teamId: 'controller-pod',
    transport: readTransport,
  }));

  registry.register(new ExternalMCPToolAdapter({
    toolId: 'github.pull_request_review_write',
    displayName: 'GitHub PR Review Write',
    teamId: 'controller-pod',
    transport: writeTransport,
  }));

  registry.register(new ExternalMCPToolAdapter({
    toolId: 'github.add_comment_to_pending_review',
    displayName: 'GitHub Add Comment to Pending Review',
    teamId: 'controller-pod',
    transport: writeTransport,
  }));
} else {
  // Surface "GitHub connection required" message in the PR panel
  vscode.window.showWarningMessage(
    'Omni PR Review: GitHub authentication not available. Connect your GitHub account to enable PR review features.'
  );
}
```

---

## Cursor Adapter

Cursor re-exports VS Code adapter without modification:

```typescript
// packages/adapters/cursor/src/activate.ts
export { activate, deactivate } from '@omni/adapters-vscode';
```

No separate transport, authentication, or registry wiring is required for Cursor.

---

## MCP Configuration File (optional, for manual IDE setup)

If developers want to configure the GitHub MCP server directly in the IDE (outside the extension's programmatic registration), they can add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "github-pr-review-read": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "X-MCP-Toolsets": "pull_requests,context",
        "X-MCP-Readonly": "true"
      }
    }
  }
}
```

This is supplementary. The extension's programmatic registration takes precedence.

---

## Error Conditions

| Condition | Handling |
| --------- | -------- |
| OAuth session not available | Fall back to PAT; if PAT also missing, skip registration and show warning |
| HTTP 401 from GitHub MCP | `SidecarResponse { acknowledged: false, error: "GitHub MCP HTTP error: 401 Unauthorized" }` |
| HTTP 429 (rate limit) | `SidecarResponse { acknowledged: false, error: "GitHub MCP HTTP error: 429 Too Many Requests" }` |
| Network timeout (fetch) | `SidecarResponse { acknowledged: false, error: "GitHub MCP request timed out" }` — implement via `AbortController` with 30s timeout |
| Invalid JSON response | `SidecarResponse { acknowledged: false, error: "GitHub MCP response parse error" }` |
