# Omni Engineering Constitution

## 1. Authority And Scope

This is the single central constitution for the repository and is the source of truth for delivery governance.

- Canonical path: `specs/constitution.md`
- Applies to all teams (`teams/team-a` through `teams/team-d`), shared packages, adapters, controller code, and CI/CD workflows
- Team-level documents must comply with this file and must not define conflicting constitutional rules

## 2. Architecture Principles (Non-Negotiable)

### 2.1 Hexagonal Architecture

The platform follows Ports and Adapters.

- Core contracts and domain behavior live in `packages/core`
- IDE-specific behavior lives only in adapter packages
- Dependency direction must point inward toward core

### 2.2 Boundary Rule

Domain and team feature logic must not import IDE SDKs directly.

- Forbidden in team and core logic: direct imports such as `vscode` or JetBrains SDK bindings
- Required abstraction: `IDEActionPort` and related ports from `@omni/core`

### 2.3 MCP Tool Model

MCP tools are project-global capabilities, not team-owned assets.

- Shared tool registry belongs to `packages/mcp`
- Team features consume tools through platform ports and registry APIs
- Tool enablement/disablement must be governed by MCP config

## 3. Team Ownership And Folder Structure

### 3.1 Team Isolation

Each team owns only its own workspace package and feature folders.

- Team code location: `teams/<team>/src/`
- Team manifests location: `teams/<team>/manifests/`
- Team specs location: `teams/<team>/specs/`
- Cross-team edits require explicit review from impacted team maintainers

### 3.2 Spec Folder Contract

All feature specs must be feature-scoped folders.

- Required path shape: `teams/<team>/specs/<feature>/`
- Root-level spec files under `teams/<team>/specs/` are prohibited
- Legacy `specs/features` layout is prohibited

### 3.3 Required Files Per Feature

Every `teams/<team>/specs/<feature>/` folder must contain all of:

1. `openspec.json`
2. `spec.md`
3. `plan.md`
4. `tasks.md`
5. `research.md`

## 4. Specification And Planning Governance

### 4.1 Spec-First Delivery

No implementation starts before specification.

- Feature work must begin from a valid team-scoped specification
- Implementation PRs must include or reference approved spec artifacts

### 4.2 OpenSpec Minimum Validity

`openspec.json` must satisfy these baseline rules:

1. `name` equals `@omni/<team>`
2. `version` is a string
3. `tools` is an array

### 4.3 Central Constitution Reference

All team planning and analysis flows must treat this central constitution as authoritative.

- Team workflows must reference `specs/constitution.md`
- No duplicate constitutions under team or tool subfolders

## 5. CI/CD And Quality Gates

### 5.1 Required Automated Gates

The following gates are mandatory before release workflows:

- `node scripts/validate-spec.js` for constitution and spec-structure compliance
- Build, lint, and test execution for changed team scopes in CI
- Packaging validation for team and unified artifacts

### 5.2 Workflow Policy

Release and publish pipelines must keep constitutional checks enabled.

- Team artifact and deploy workflows must preserve validation behavior
- Manual publish workflows must run spec validation before publish steps
- Global unified release must run spec validation before version bump and release

## 6. Versioning And Release Governance

### 6.1 Semantic Versioning

All published versions must follow semantic versioning (`MAJOR.MINOR.PATCH`).

### 6.2 Team Version Consistency

For a given team, IDE manifests must use a consistent version across VS Code, Cursor, and JetBrains targets.

### 6.3 Duplicate Release Prevention

A version that already exists in `releases/` must not be reused.

- Validation is enforced by `scripts/validate-version.js`

### 6.4 Release Titles

GitHub release titles must follow the approved naming format:

- `[Global] VS Code vX.Y.Z`
- `[Team A] VS Code vX.Y.Z`
- `[Team B] VS Code vX.Y.Z`
- `[Team C] VS Code vX.Y.Z`
- `[Team D] VS Code vX.Y.Z`

## 7. Language And Engineering Standards

### 7.1 Primary Language

TypeScript is the primary implementation language.

- Node runtime baseline: Node.js 20+
- TypeScript baseline: strict mode enabled via shared base config
- Project references and workspace boundaries must be preserved

### 7.2 Allowed Supporting Languages

Supporting automation scripts may use:

- JavaScript/Node.js for build, deploy, and validation automation
- PowerShell and shell scripts for SpecKit automation and environment tooling
- Python only for explicit deployment helpers where already established

### 7.3 Coding Discipline

- Keep public contracts stable unless a deliberate versioned change is planned
- Prefer typed interfaces and explicit error handling
- Maintain portability across supported IDEs by honoring port boundaries

## 8. Observability, Security, And Secrets

- Telemetry must flow through `TelemetryPort` abstractions
- Do not emit PII in telemetry payloads
- Secrets/tokens must never be committed; use environment variables and CI secrets

## 9. Enforcement

Constitution violations are release blockers.

- CI failures in constitutional gates must block merge/release
- Exceptions require explicit documented approval from platform maintainers and must be time-bound
