/**
 * JetBrains sidecar entry point.
 *
 * This file is the `main` of the packaged .zip artifact.
 * It starts a local JSON-RPC HTTP server that a JetBrains plugin communicates with
 * to execute MCP tools and bridge IDE actions.
 *
 * Environment variables:
 *   OMNI_SIDECAR_PORT  — TCP port to listen on (default: 7654)
 *   OMNI_SIDECAR_HOST  — Host to bind (default: 127.0.0.1)
 */
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { isGitHubToolCall, JetBrainsSidecarBridge } from '.';
import { MCPRegistry, registerGlobalGitHubTools } from '@omni/mcp';
import { ExampleTool } from '@omni/mcp/tools';
import type { MCPConfig } from '@omni/mcp';
import { TEAM_ID } from './__generated__/team-config';

const PORT = parseInt(process.env.OMNI_SIDECAR_PORT ?? '7654', 10);
const HOST = process.env.OMNI_SIDECAR_HOST ?? '127.0.0.1';

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const config = resolveConfig();
const registry = new MCPRegistry(config);
registry.register(new ExampleTool());
registerGlobalGitHubTools(registry, () => JetBrainsSidecarBridge);

// ---------------------------------------------------------------------------
// HTTP / JSON-RPC server
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, teamId: TEAM_ID, tools: registry.listTools() }));
    return;
  }

  if (req.method !== 'POST' || req.url !== '/rpc') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found. Use POST /rpc or GET /health.' }));
    return;
  }

  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', async () => {
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));

      if (isGitHubToolCall(body) && !hasGitHubToken()) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: body?.id ?? null,
            status: 'failure',
            error: {
              code: 401,
              message: 'GitHub connection required. Set GITHUB_PERSONAL_ACCESS_TOKEN before using GitHub MCP tools.',
            },
          }),
        );
        return;
      }

      const response = await JetBrainsSidecarBridge(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: String(err) } }));
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[omni-sidecar] Team: ${TEAM_ID} | Listening on ${HOST}:${PORT}`);
  console.log(`[omni-sidecar] Health: http://${HOST}:${PORT}/health`);
  console.log(`[omni-sidecar] RPC   : POST http://${HOST}:${PORT}/rpc`);
});

server.on('error', (err) => {
  console.error(`[omni-sidecar] Server error:`, err.message);
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function resolveConfig(): MCPConfig {
  const configPath = path.join(__dirname, '..', 'mcp.config.json');
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as MCPConfig;
    } catch {
      // fall through
    }
  }
  return { version: '1', tools: [{ toolId: 'omni-example', enabled: true }] };
}

function hasGitHubToken(): boolean {
  const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  return typeof token === 'string' && token.trim().length > 0;
}
