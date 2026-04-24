# Contributing to Omni

Welcome! This document is a quick-start guide for contributors. For the full, step-by-step feature development workflow — including spec writing, folder structure, using MCP tools, committing, and building artifacts — please read the **[Developer Onboarding Guide](./onboarding.md)**.

---

## Quick Links

| Topic | Document |
|---|---|
| Full feature development lifecycle (SDD, MCP tools, build) | [onboarding.md](./onboarding.md) |
| Architecture overview and diagrams | [architecture.md](./architecture.md) |
| Build and deployment process | [deployment.md](./deployment.md) |
| MCP Tools catalogue | [mcp-tools.md](./mcp-tools.md) |
| Telemetry and governance | [telemetry.md](./telemetry.md) |

---

## Core Principles

1.  **Spec first, code second.** Every feature starts with specs in `teams/<team>/specs/<feature>/` and must follow the central constitution at `specs/constitution.md` before implementation begins.

2.  **Stay in your lane.** Your code lives in `teams/<your-team>/src/`. You do not modify other teams' code or the core platform packages (`@omni/core`, `@omni/mcp`).

3.  **Use the `IDEActionPort`.** Never import `vscode` or any IDE SDK directly. All IDE interaction goes through `@omni/core`'s `IDEActionPort`. ESLint enforces this automatically.

4.  **Use Conventional Commits.** All commit messages must follow the `feat(scope): description` format. This is enforced by a Git commit hook.

5.  **Leverage MCP Tools.** Before writing custom file I/O, command execution, or diagnostics logic, check whether an MCP tool already exists for it. The full catalogue is in [mcp-tools.md](./mcp-tools.md).
