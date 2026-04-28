// ---------------------------------------------------------------------------
// Sidecar IPC — used by ExternalMCPToolAdapter to talk to external MCP servers
// ---------------------------------------------------------------------------

export type RpcInvocationStatus = 'success' | 'failure';

export interface SidecarRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
  correlationId?: string;
}

export interface SidecarResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  status?: RpcInvocationStatus;
  correlationId?: string;
  retryAfter?: number;
  error?: {
    code: number;
    message: string;
    data?: unknown;
    retryAfter?: number;
  };
}

export type SidecarTransport = (request: SidecarRequest) => Promise<SidecarResponse>;

// ---------------------------------------------------------------------------
// Webview ↔ Extension IPC — JSON-RPC 2.0 envelopes for panel messaging
//
// ALL messages crossing the webview boundary MUST use these types.
// In the webview script:   vscode.postMessage(request)
// In the extension:        panel.webview.postMessage(response | notification)
// ---------------------------------------------------------------------------

/**
 * Message sent FROM the webview TO the extension host.
 * Always has an `id` — the extension must reply with a matching WebviewResponse.
 */
export interface WebviewRequest<TParams = unknown> {
  jsonrpc: '2.0';
  /** Monotonically increasing integer, unique per webview session. */
  id: number | string;
  method: string;
  params?: TParams;
}

/**
 * Message sent FROM the extension host TO the webview in direct reply to a WebviewRequest.
 * Exactly one of `result` or `error` is present.
 */
export interface WebviewResponse<TResult = unknown> {
  jsonrpc: '2.0';
  /** Matches the `id` of the originating WebviewRequest. */
  id: number | string;
  result?: TResult;
  error?: {
    /** Standard JSON-RPC error codes: -32700 parse, -32600 invalid, -32601 method not found,
     *  -32602 invalid params, -32603 internal. Application errors use -32000 to -32099. */
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * One-way push FROM the extension host TO the webview — no reply expected.
 * Use for streaming tokens, progress updates, and status change events.
 * Intentionally has no `id` field to distinguish from WebviewResponse.
 */
export interface WebviewNotification<TParams = unknown> {
  jsonrpc: '2.0';
  method: string;
  params?: TParams;
}

/** Standard JSON-RPC 2.0 error codes. */
export const RpcErrorCode = {
  ParseError:     -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams:  -32602,
  InternalError:  -32603,
  /** First application-defined error code. Subtract for specific errors. */
  AppError:       -32000,
} as const;
