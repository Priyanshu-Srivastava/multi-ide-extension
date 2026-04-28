# Quickstart: PR Review Visualizer and Analyzer

## Prerequisites

- Node.js 20+
- npm workspace dependencies installed
- Valid GitHub MCP configuration available to adapter runtime

## Validate Spec Assets

- Run spec validation:
  - npm run validate:spec

## Build Shared Packages and Team Scope

- Build everything:
  - npm run build

- Optional adapter-targeted build:
  - npm run build:vscode

## Implementation Verification Checklist

1. Open a PR containing at least 5 changed text files.
2. Confirm first page starts at deterministic entry-point.
3. Use Next repeatedly and confirm recursive-first traversal with backtracking.
4. Switch between Code and Tests tabs and verify state is preserved independently.
5. Confirm every visible hunk shows AI analysis fields.
6. Submit at least one line comment and verify it lands on the PR at correct target.
7. Simulate failed comment submission and verify draft preservation and retry.

## Expected Quality Gates

- TypeScript build passes for affected packages.
- Lint passes for affected packages.
- Spec validation passes.
- Unit/integration tests for traversal and mapping pass.
