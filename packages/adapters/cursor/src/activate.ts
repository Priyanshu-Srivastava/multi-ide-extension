/**
 * Cursor adapter activate — Cursor is VS Code API-compatible.
 * Reuses the VS Code adapter's activate/deactivate functions directly.
 * The TEAM_ID for this build is injected via __generated__/team-config.ts
 * by scripts/build.js before compilation.
 *
 * The cursor build script also generates the same TEAM_ID into the vscode
 * adapter's __generated__/team-config.ts so that the imported activate uses
 * the correct team context.
 */
export { activate, deactivate } from '@omni/adapters-vscode';
