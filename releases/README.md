# Release Versions

This directory contains released versions of the Omni IDE extension.

## Current Releases

- **v1.0.0** — Initial release (all teams, all IDEs)

## Versioning Strategy

### Rules
1. **Semantic Versioning**: All releases must follow `MAJOR.MINOR.PATCH` (e.g., `1.2.3`)
2. **Single Version Per Release**: All teams/IDEs in a release must share the same version number
3. **No Duplicate Releases**: Build process validates that a version hasn't already been released
4. **Version Hierarchy**: Version must be updated in all team manifests (`teams/*/manifests/*.json`)

### Validation
Before building, the version validation script checks:
- ✅ No duplicate versions in releases/
- ✅ Valid semantic versioning format
- ✅ All team IDEs have matching versions

Run validation:
```bash
npm run validate:versions      # Check all teams
node scripts/validate-version.js --team team-a --ide vscode  # Check specific team/IDE
```

### Release Process
1. **Update versions** in all team manifests:
   ```json
   // teams/team-a/manifests/vscode.json
   { "version": "1.2.0", ... }
   ```

2. **Validate** before building:
   ```bash
   npm run validate:versions
   ```

3. **Build** (validation runs automatically):
   ```bash
   npm run build:vscode   # or build:cursor, build:jetbrains, build:all-adapters
   ```

4. **Create release directory**:
   ```bash
   mkdir -p releases/v1.2.0
   ```

5. **Archive artifacts** (optional, for traceability):
   ```bash
   cp artifacts/omni-*.vsix releases/v1.2.0/
   ```

## Build Prevention
If you try to build with a version that's already released, the build will fail:

```
❌ Version validation failed: Version v1.0.0 has already been released. 
   Please bump the version in teams/team-a/manifests/*.json
```

To continue, increment the version in all team manifests and try again.
