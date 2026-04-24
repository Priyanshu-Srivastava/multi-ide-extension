# SpecKit Constitution

This constitution defines mandatory rules for specification governance across all teams.

## Scope

These rules apply to every team package under teams/*.

## Mandatory Structure

Each team must store feature specs in:

- teams/<team>/specs/<feature-name>/openspec.json

Root-level spec files directly under teams/<team>/specs/ are not allowed.

## Required Files Per Feature

Every feature folder must include these files:

1. openspec.json
2. spec.md
3. plan.md
4. tasks.md
5. research.md

## OpenSpec Requirements

The openspec.json file must satisfy:

1. name must equal @omni/<team-id>
2. version must be a string
3. tools must be an array

## Spec-First Policy

Implementation PRs must include or reference an approved feature spec update before merging code.

## Validation Gate

CI must run scripts/validate-spec.js. A failed validation blocks merge and release workflows.

## Ownership

Each team owns its own feature folders under teams/<team>/specs/.
Cross-team spec changes require explicit review from impacted team maintainers.
