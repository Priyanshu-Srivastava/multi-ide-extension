import { SidecarRequest, SidecarResponse, SidecarTransport } from '@omni/core';

/**
 * JetBrains sidecar transport implementation.
 * Implements the SidecarTransport function signature from @omni/core.
 */
export const JetBrainsSidecarBridge: SidecarTransport = async (
  request: SidecarRequest
): Promise<SidecarResponse> => {
  // Serialize the request to the JVM sidecar via HTTP/stdio in production.
  return {
    jsonrpc: '2.0',
    id: request.id,
    result: { acknowledged: true, method: request.method },
  };
};
