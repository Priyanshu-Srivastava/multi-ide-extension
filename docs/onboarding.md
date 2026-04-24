# Developer Onboarding Guide

This guide is the single source of truth for any developer joining the Omni platform. It walks you through everything from setting up your local environment to writing a feature spec, implementing it, consuming MCP tools, committing your changes, and finally building a deployable extension artifact.

---

## 1. Initial Setup

Before you begin, ensure your local machine has the mandatory prerequisites installed.

- **Node.js >= 20**: The entire monorepo, including all build scripts and adapters, runs on Node.js. Use [nvm](https://github.com/nvm-sh/nvm) to manage versions easily.
- **npm >= 10**: Used for workspace dependency management.
- **Git**: For version control.

Once the tools are installed, clone the repository and install all workspace dependencies from the root. The monorepo uses **npm Workspaces**, which means running `npm install` once at the root is all that is needed — it will automatically link all local packages together (e.g., `@omni/core` will be resolvable from a team package without any manual steps).

```bash
# Clone the repository
git clone https://github.com/Priyanshu-Srivastava/multi-ide-extension.git
cd multi-ide-extension

# Install all dependencies across all packages in one command
npm install
```

---

## 2. Understanding the Architecture (Essential Reading)

Before writing a single line of code, you must understand the project's core architectural principle: **Hexagonal Architecture (Ports & Adapters)**.

The key rule is:

> **Your feature code must NEVER import `vscode`, `jetbrains`, or any other IDE SDK directly.**

Instead, all interaction with the IDE happens through a single, clean interface called the `IDEActionPort`, provided by `@omni/core`. This means your feature code is completely **portable** — it runs identically on VS Code, Cursor, and JetBrains without any changes.

ESLint rules are configured to automatically block any direct IDE imports. If you try to import `vscode`, your build will fail.

---

## 3. Feature Development Lifecycle: Spec-Driven Development (SDD)

Every new feature must follow this complete lifecycle. **Do not write any implementation code until the spec is reviewed and approved.**

### Step 1: Design Your Feature with a Spec Document

A Spec (or Software Design Document) is a written proposal for your feature. Writing it first forces clarity of thought, prevents wasted effort, and ensures your team and stakeholders are aligned before any code is written. It is the single most valuable investment you can make before implementing.

**Where to put it:** Your team has a dedicated `specs` folder. Create a new Markdown file there, named after your feature.

```
teams/team-a/specs/
└── feature-new-widget.md   ← your new spec file
```

**Your spec MUST be checked into Git and include the following sections:**

| Section | Description |
|---|---|
| **Problem Statement** | What user or business problem does this feature solve? Why are we building it now? |
| **Proposed Solution** | A plain-English description of how the feature will work from the user's perspective. Include mockups or user flow diagrams where helpful. |
| **Technical Design** | Which `IDEActionPort` methods will you call? Will you need new MCP Tools? What is the data flow? |
| **Scope & Limitations** | Explicitly list what is *in scope* for version 1 and what is explicitly *out of scope*. This prevents scope creep. |
| **Open Questions & Risks** | List any unresolved questions or technical risks before you start implementation. |

**The mandatory review gate:** Once your spec is written, open a **Pull Request containing only the spec document**. This PR must be reviewed and approved by your team lead and a lead architect before you may proceed. This is non-negotiable.

---

### Step 2: Organize Your Feature Code

Once the spec is approved and merged, you can start coding. All your code **must** live inside your team's package. You have no write access to other teams' packages or to `@omni/core` and `@omni/mcp`.

We strongly recommend the following folder structure to keep your feature clean and maintainable. Separating UI code from core/backend logic makes features easier to test, reason about, and eventually migrate.

```
teams/team-a/src/
├── features/
│   └── new-widget/
│       ├── index.ts              # The public entry point for this feature. Exports
│       │                         # the main function that the adapter will call.
│       ├── ui/
│       │   └── WidgetView.ts     # Code responsible for rendering UI. For example,
│       │                         # creating and managing a VS Code Webview panel,
│       │                         # building tree views, or managing status bar items.
│       │                         # This code should only call IDEActionPort.window.*
│       └── core/
│           └── dataProvider.ts   # Pure business logic and data processing. This code
│                                 # should have zero UI concerns and be easily unit-tested
│                                 # with a simple mock IDEActionPort.
├── utils/
│   └── string-helpers.ts         # Reusable helper functions shared across your team's features.
└── index.ts                      # Your team package's public API surface.
```

---

### Step 3: Implement Using the `IDEActionPort`

Every interaction with the IDE — showing messages, reading files, getting active editor state — must go through the `IDEActionPort`. This interface is injected into your feature functions; you never create an instance yourself. This is what makes your code testable: in unit tests, you simply pass in a mock object.

The following example demonstrates the correct and incorrect patterns:

```typescript
// teams/team-a/src/features/new-widget/core/dataProvider.ts

import { IDEActionPort } from '@omni/core';
// ✅ Importing from @omni/core is the ONLY correct way to get IDE access.
// @omni/core is MIT-licensed and is the shared foundation for the entire project.

// ✅ CORRECT PATTERN: The IDEActionPort is received as a parameter (dependency injection).
// This function has no hard dependency on vscode or any IDE SDK. It can be called from
// any adapter (VS Code, JetBrains, Cursor) without modification.
export function showWelcomeMessage(ide: IDEActionPort): void {
  // The 'ide' object here is the VS Code or JetBrains adapter at runtime,
  // but a simple mock object during unit tests.
  ide.window.showInformationMessage('Hello from Team A! Feature is active.');
}

// ❌ WRONG PATTERN: This will be caught and blocked by ESLint before it even compiles.
// Direct IDE imports break portability and violate the architecture.
// import * as vscode from 'vscode';
// export function showWrongMessage() {
//   vscode.window.showInformationMessage('This will fail the lint check!');
// }
```

---

### Step 4: Use MCP Tools for Cross-IDE Capabilities

The Omni platform ships with a catalogue of built-in **MCP (Model Context Protocol) Tools** — these are MIT-licensed, globally available tools that your feature can call to perform common tasks without writing that logic yourself. They include tools for reading and writing files, searching the workspace, getting diagnostics, running git commands, and more.

**Why use MCP Tools?** Because they are already implemented, tested, and work consistently across all supported IDEs (VS Code, JetBrains, Cursor). Writing the same logic yourself would be duplicative and potentially break cross-IDE support.

**Available global tools (all MIT licensed, defined in `packages/mcp/src/tools/`):**
- `workspace.readFile` — Read the content of any file in the workspace.
- `workspace.findFiles` — Search for files by glob pattern.
- `workspace.writeFile` — Create or overwrite a file.
- `workspace.listDirectory` — List the contents of a directory.
- `workspace.getDiagnostics` — Get errors and warnings reported by the language server.
- `vscode.executeCommand` — Run any registered VS Code command.
- `vscode.getActiveEditor` — Get information about the currently open file.
- `vscode.gitStatus` — Get the current git status of the workspace.

**How to call an MCP Tool from your feature:**

The example below shows how to use the `workspace.readFile` tool. Note how the code handles both the success and failure paths — defensive handling is important because file system operations can fail for many reasons (file not found, permission denied, etc.).

```typescript
// teams/team-a/src/features/new-widget/core/dataProvider.ts

import { IDEActionPort } from '@omni/core';

export async function loadConfigFile(ide: IDEActionPort, configPath: string): Promise<string | null> {
  // Step 1: Optionally discover all available tools at runtime.
  // This is useful during development to see what's available.
  // In production code, you can skip this and call executeTool directly.
  const availableTools = await ide.mcp.listTools();
  console.log('MCP Tools available to this feature:', availableTools.map(t => t.id));

  // Step 2: Execute the specific tool you need.
  // The second argument is the input object, which must match the tool's schema.
  // Each tool's schema is defined in packages/mcp/src/tools/<tool-name>.ts.
  try {
    const result = await ide.mcp.executeTool('workspace.readFile', {
      path: configPath, // The path relative to the workspace root
    });

    if (result.success) {
      // Step 3: On success, the result.content property contains the file's text.
      ide.window.showInformationMessage(`Config loaded successfully from ${configPath}.`);
      return result.content as string;
    } else {
      // Step 4: On a handled failure (e.g., file not found), result.success is false.
      // The error details are in result.error.
      const reason = result.error?.message ?? 'Unknown reason';
      ide.window.showWarningMessage(`Could not load config file: ${reason}`);
      return null;
    }
  } catch (err: unknown) {
    // Step 5: Catch any unexpected, unhandled errors from the tool execution layer.
    const message = err instanceof Error ? err.message : String(err);
    ide.window.showErrorMessage(`An unexpected error occurred while reading the config: ${message}`);
    return null;
  }
}
```

---

### Step 5: Write and Run Tests

Because your feature logic is fully decoupled from any IDE SDK via the `IDEActionPort`, unit testing is straightforward. You simply create a plain JavaScript mock object that satisfies the `IDEActionPort` interface and pass it to your functions. No special VS Code testing setup is required.

Place your test files alongside the code they test (e.g., `dataProvider.test.ts` next to `dataProvider.ts`).

To run your team's tests:

```bash
# Run tests for your specific team's package only.
# Replace 'team-a' with your actual team package name.
npm test --workspace=@omni/team-a

# Or, to run all tests across the entire monorepo using Turborepo:
npx turbo run test
```

---

### Step 6: Commit Your Changes

This project uses the **Conventional Commits** standard for all commit messages. This is not optional — it is enforced via a Git commit hook and is the basis for automated changelog generation and Semantic Versioning. An incorrectly formatted commit message will be rejected.

The format is: `type(scope): short description`

| Type | When to use |
|---|---|
| `feat` | A new feature visible to the end user |
| `fix` | A bug fix |
| `docs` | Documentation changes only |
| `refactor` | Code restructuring without changing behaviour |
| `test` | Adding or fixing tests |
| `chore` | Maintenance tasks (updating deps, build scripts, etc.) |

**Versioning:** The extension version for your team is managed in the manifest files (e.g., `teams/team-a/manifests/vscode.json`). Before releasing, you must bump the `"version"` field following [Semantic Versioning](https://semver.org/) rules:
- `patch` (1.0.0 → 1.0.1): Bug fixes and non-breaking internal changes.
- `minor` (1.0.0 → 1.1.0): New backwards-compatible features.
- `major` (1.0.0 → 2.0.0): Breaking changes.

```bash
# Stage your feature files. Only stage files within your team's directory.
git add teams/team-a/src/features/new-widget/
git add teams/team-a/specs/feature-new-widget.md

# Commit using the Conventional Commits format.
# The scope should be your team name for clarity.
git commit -m "feat(team-a): add new widget feature" \
           -m "Implements the design from specs/feature-new-widget.md.
The widget reads a config file via the workspace.readFile MCP tool
and displays a summary panel to the user."

# Push to your feature branch.
git push origin feature/team-a-new-widget
```

---

### Step 7: Build the Extension Artifact

Once your feature is implemented, tested, and code-reviewed, you can build the final extension artifact to verify it works end-to-end inside a real IDE.

The master build script (`scripts/build.js`) orchestrates the entire process: it injects your team ID, compiles all TypeScript, stages the required `node_modules`, applies your team's manifest, and packages the final artifact.

```bash
# Build a .vsix file for team-a targeting VS Code.
# The output will appear in the artifacts/ directory at the repo root.
node scripts/build.js --team team-a --ide vscode

# Build a .vsix file for team-b targeting Cursor (same format as VS Code).
node scripts/build.js --team team-b --ide cursor

# Build a .zip sidecar package for team-c targeting JetBrains.
node scripts/build.js --team team-c --ide jetbrains
```

Once the artifact is created, install it manually in your target IDE to perform final end-to-end validation.

| IDE | How to install |
|---|---|
| **VS Code / Cursor** | Open the Extensions view → `...` menu → `Install from VSIX` → select the `.vsix` file. |
| **JetBrains** | `Settings` → `Plugins` → gear icon → `Install Plugin from Disk` → select the `.zip` file. |

---

## 4. Advanced: Adding a New Team

### 1. Create the workspace folder

```bash
mkdir -p teams/team-e/src/features
mkdir -p teams/team-e/specs
mkdir -p teams/team-e/manifests
```

### 2. `teams/team-e/package.json`

```json
{
  "name": "@omni/team-e",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -b",
    "test": "echo \"No tests configured for @omni/team-e\"",
    "lint": "eslint . --ext .ts",
    "spec:validate": "node ../../scripts/validate-spec.js"
  },
  "dependencies": {
    "@omni/core": "*"
  }
}
```

### 3. `teams/team-e/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../../packages/core" }
  ]
}
```

### 4. `teams/team-e/src/index.ts`

```typescript
export { executeTeamEFeature } from './features';
```

### 5. `teams/team-e/src/features/index.ts`

```typescript
import { IDEActionPort, TelemetryPort } from '@omni/core';

export function executeTeamEFeature(port: IDEActionPort, telemetry: TelemetryPort) {
  return port.executeCommand('team-e:run', { feature: 'executor-e' });
}
```

### 6. Create manifests for each IDE

`teams/team-e/manifests/vscode.json`:
```json
{
  "name": "omni-vscode-team-e",
  "displayName": "Omni IDE — Team E",
  "description": "Omni multi-IDE extension for Team E.",
  "version": "1.0.0",
  "publisher": "your-publisher",
  "license": "MIT",
  "engines": { "vscode": "^1.80.0" },
  "categories": ["Other", "AI"],
  "activationEvents": ["onStartupFinished"],
  "keywords": ["omni", "mcp", "team-e"],
  "contributes": {
    "commands": [
      { "command": "omni.team-e.showInfo",  "title": "Omni: Show Extension Info" },
      { "command": "omni.team-e.listTools", "title": "Omni: List MCP Tools" }
    ]
  },
  "repository": { "type": "git", "url": "https://github.com/your-org/multi-ide-extension" }
}
```

Create similar files for `cursor.json` and `jetbrains.json`.

### 7. Create the spec

`teams/team-e/specs/openspec.json`:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Team E API Spec",
  "type": "object",
  "properties": {
    "executor-e": {
      "type": "object",
      "description": "Team E main executor"
    }
  }
}
```

### 8. Register in `tsconfig.json` (root solution file)

Add to the `references` array:
```json
{ "path": "teams/team-e" }
```

### 9. Add `VALID_TEAMS` to build/deploy scripts

In `scripts/build.js` and `scripts/deploy.js`:
```javascript
const VALID_TEAMS = ['team-a', 'team-b', 'team-c', 'team-d', 'team-e'];
```

### 10. Add team to CI workflow matrices

In `.github/workflows/build-vscode.yml`, `build-cursor.yml`, `build-jetbrains.yml`:
```yaml
matrix:
  team: [team-a, team-b, team-c, team-d, team-e]
```

Add a new `team-e.yml` workflow (copy `team-a.yml`, replace `team-a` with `team-e`).

---

## Adding a New IDE Adapter

### 1. Create the adapter folder

```bash
mkdir -p packages/adapters/newide/src/__generated__
```

### 2. `packages/adapters/newide/package.json`

```json
{
  "name": "@omni/adapters-newide",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -b",
    "test": "echo \"No tests configured\"",
    "lint": "eslint . --ext .ts"
  },
  "dependencies": {
    "@omni/core": "*",
    "@omni/mcp": "*"
  }
}
```

### 3. Implement `IDEActionPort`

`packages/adapters/newide/src/index.ts`:
```typescript
import { IDEActionPort, TelemetryPort } from '@omni/core';

export class NewIDEAdapter implements IDEActionPort {
  constructor(private telemetry: TelemetryPort) {}

  async executeCommand(command: string, payload?: unknown): Promise<unknown> {
    this.telemetry.recordEvent('newide_command', { command, payload });
    // call the new IDE's API here
    return { status: 'ok', command };
  }
}
```

### 4. Create `__generated__/team-config.ts` placeholder

```typescript
// AUTO-GENERATED by scripts/build.js — do not edit manually
export const TEAM_ID = '__placeholder__';
```

### 5. Add `tsconfig.json`

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../../core" },
    { "path": "../../mcp" }
  ]
}
```

### 6. Register in root `tsconfig.json`

```json
{ "path": "packages/adapters/newide" }
```

### 7. Add the build/deploy scripts

Create `scripts/adapters/newide/build.js` and `scripts/adapters/newide/deploy.js` mirroring the existing wrappers.

### 8. Add a CI workflow

Create `.github/workflows/build-newide.yml` by copying `build-vscode.yml` and replacing `vscode` with `newide`.

---

## Code Style

- **TypeScript strict mode** enforced via `tsconfig.base.json`
- **No `any`** — use `unknown` and narrow with `isRecord()` from `@omni/core/utils`
- **Imports** — teams may only import from `@omni/core`, not from adapter packages
  - Enforced by `.eslintrc.json` `no-restricted-imports` rules
- **Tests** — place in `src/tests/` or alongside the source file as `*.test.ts`

---

## Running Tests

```bash
# All packages
npm test

# Specific package
npx turbo run test --filter=@omni/team-a
npx turbo run test --filter=@omni/adapters-vscode
```

---

## Validating Specs

```bash
# Validate all team specs
npm run validate:spec

# The CI gate runs this automatically on PRs that modify teams/**/specs/**
```
