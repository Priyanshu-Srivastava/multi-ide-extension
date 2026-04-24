/**
 * @omni/adapters — IDE adapter registry.
 * Import the right adapter based on the runtime environment.
 */
export { VSCodeAdapter } from '@omni/adapters-vscode';
export { JetBrainsSidecarBridge } from '@omni/adapters-jetbrains';
export { CursorAdapter } from '@omni/adapters-cursor';
