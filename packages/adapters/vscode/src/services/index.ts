/**
 * VS Code adapter services — infrastructure helpers only.
 *
 * `WorkspaceReader` wraps the MCP tool registry behind a simple API so
 * feature code in team folders can read files and find patterns without
 * knowing MCP tool IDs or input shapes.
 *
 * Orchestration logic (what to read, what prompts to build, how to
 * interpret results) belongs in the team feature folder — not here.
 */
export { WorkspaceReader } from './workspace-reader';
