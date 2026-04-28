const fs = require("fs");
const path = require("path");

const REQUIRED_SPEC_JSON = "openspec.json";
const REQUIRED_SPECKIT_FILES = ["spec.md", "plan.md", "tasks.md", "research.md"];
const REQUIRED_GLOBAL_FILES = ["spec.md", "sceps.mc"];
const SKIP_DIRS = new Set([".git", "node_modules", "dist", "build", ".turbo", "artifacts", "releases"]);

function walkFiles(baseDir, filter) {
  const results = [];

  function visit(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) {
          continue;
        }
        visit(fullPath);
        continue;
      }

      if (!filter || filter(fullPath)) {
        results.push(fullPath);
      }
    }
  }

  if (fs.existsSync(baseDir)) {
    visit(baseDir);
  }
  return results;
}

function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function isLikelyConfigFile(filePath) {
  const normalized = normalizePath(filePath);
  const ext = path.extname(filePath).toLowerCase();
  if ([".json", ".yml", ".yaml", ".env", ".toml", ".ini"].includes(ext)) {
    return true;
  }

  return /(^|\/)mcp\.config\.json$/i.test(normalized) || /(^|\/)\.npmrc$/i.test(normalized);
}

function validateTeamGitHubMCPPathLint(rootDir) {
  const teamSrcDir = path.join(rootDir, "teams");
  const teamFiles = walkFiles(teamSrcDir, (fullPath) => fullPath.endsWith(".ts") || fullPath.endsWith(".tsx"));
  let violations = 0;

  for (const filePath of teamFiles) {
    const normalized = normalizePath(filePath);
    if (!/\/teams\/[^/]+\/src\//.test(normalized)) {
      continue;
    }

    const content = fs.readFileSync(filePath, "utf8");
    const hasExternalAdapter = /ExternalMCPToolAdapter/.test(content);
    const hasGitHubToolId = /github\.(pull_request_read|list_pull_requests|pull_request_review_write|add_comment_to_pending_review)/.test(content);
    const hasGitHubMCPToolImpl = /implements\s+MCPToolPort/.test(content) && /github/i.test(content);

    if (hasExternalAdapter || hasGitHubToolId || hasGitHubMCPToolImpl) {
      console.error(`Team path-lint violation: GitHub MCP tool implementation pattern detected in ${normalized}.`);
      violations += 1;
    }
  }

  return violations;
}

function validateNoPersistedSecrets(rootDir) {
  const files = walkFiles(rootDir, (fullPath) => isLikelyConfigFile(fullPath));
  let violations = 0;

  const secretPatterns = [
    /\bghp_[A-Za-z0-9]{20,}\b/g,
    /\bgho_[A-Za-z0-9]{20,}\b/g,
    /\bgithub_pat_[A-Za-z0-9_]{30,}\b/g,
    /GITHUB_PERSONAL_ACCESS_TOKEN\s*[:=]\s*["']?[A-Za-z0-9_\-]{20,}/g,
  ];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf8");
    const normalized = normalizePath(filePath);

    for (const pattern of secretPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) {
        console.error(`Secrets policy violation: potential credential found in ${normalized}.`);
        violations += 1;
        break;
      }
    }
  }

  return violations;
}

function validateOpenSpecJson({ jsonPath, expectedName, contextLabel }) {
  try {
    const spec = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

    if (spec.name !== expectedName) {
      console.error(`${contextLabel} has invalid spec name '${spec.name}'. Expected '${expectedName}'.`);
      return 1;
    }

    if (!spec.version || typeof spec.version !== "string") {
      console.error(`${contextLabel} is missing a valid string 'version'.`);
      return 1;
    }

    if (!Array.isArray(spec.tools)) {
      console.error(`${contextLabel} is missing 'tools' array in ${REQUIRED_SPEC_JSON}.`);
      return 1;
    }
  } catch (error) {
    console.error(`${contextLabel} has invalid JSON in ${REQUIRED_SPEC_JSON}:`, error.message);
    return 1;
  }

  return 0;
}

function fail(message) {
  console.error(`❌ Spec validation failed: ${message}`);
  process.exit(1);
}

const root = path.resolve(__dirname, "..");
const teamsDir = path.join(root, "teams");
const specsRootDir = path.join(root, "specs");
const constitutionPath = path.join(root, "specs", "constitution.md");

if (!fs.existsSync(teamsDir)) {
  fail("No teams directory found.");
}

if (!fs.existsSync(constitutionPath)) {
  fail("Missing central Speckit constitution at specs/constitution.md.");
}

const teams = fs.readdirSync(teamsDir).filter((entry) => {
  return fs.statSync(path.join(teamsDir, entry)).isDirectory();
});
let errors = 0;

for (const team of teams) {
  const specsDir = path.join(teamsDir, team, "specs");

  if (!fs.existsSync(specsDir)) {
    console.error(`Team ${team} is missing specs directory.`);
    errors += 1;
    continue;
  }

  const rootLevelSpecFiles = fs.readdirSync(specsDir).filter((entry) => {
    const fullPath = path.join(specsDir, entry);
    return fs.statSync(fullPath).isFile() && [".json", ".md"].includes(path.extname(entry));
  });

  if (rootLevelSpecFiles.length > 0) {
    console.error(
      `Team ${team} has root-level spec files in specs/: ${rootLevelSpecFiles.join(", ")}. Move them into specs/<feature-name>/.`,
    );
    errors += 1;
  }

  const featureFolders = fs.readdirSync(specsDir).filter((entry) => {
    return fs.statSync(path.join(specsDir, entry)).isDirectory();
  });

  if (featureFolders.length === 0) {
    console.error(`Team ${team} has no feature folders under specs/.`);
    errors += 1;
    continue;
  }

  for (const feature of featureFolders) {
    if (feature === "features") {
      console.error(`Team ${team} still uses legacy specs/features layout. Use specs/<feature-name>/ instead.`);
      errors += 1;
      continue;
    }

    const featureDir = path.join(specsDir, feature);
    const jsonPath = path.join(featureDir, REQUIRED_SPEC_JSON);

    if (!fs.existsSync(jsonPath)) {
      console.error(`Team ${team}, feature ${feature} is missing ${REQUIRED_SPEC_JSON}.`);
      errors += 1;
      continue;
    }

    for (const fileName of REQUIRED_SPECKIT_FILES) {
      const filePath = path.join(featureDir, fileName);
      if (!fs.existsSync(filePath)) {
        console.error(`Team ${team}, feature ${feature} is missing ${fileName}.`);
        errors += 1;
      }
    }

    errors += validateOpenSpecJson({
      jsonPath,
      expectedName: `@omni/${team}`,
      contextLabel: `Team ${team}, feature ${feature}`,
    });
  }
}

if (!fs.existsSync(specsRootDir)) {
  fail("No specs directory found.");
}

const globalFeatureFolders = fs.readdirSync(specsRootDir).filter((entry) => {
  if (entry === "constitution.md") {
    return false;
  }

  return fs.statSync(path.join(specsRootDir, entry)).isDirectory();
});

for (const feature of globalFeatureFolders) {
  if (feature === "features") {
    console.error("Global specs still uses legacy specs/features layout. Use specs/<feature-name>/ instead.");
    errors += 1;
    continue;
  }

  const featureDir = path.join(specsRootDir, feature);

  for (const fileName of REQUIRED_GLOBAL_FILES) {
    const filePath = path.join(featureDir, fileName);
    if (!fs.existsSync(filePath)) {
      console.error(`Global feature ${feature} is missing ${fileName}.`);
      errors += 1;
    }
  }
}

errors += validateTeamGitHubMCPPathLint(root);
errors += validateNoPersistedSecrets(root);

if (errors > 0) {
  fail(`${errors} spec validation issue(s) found.`);
}

console.log("✅ SpecKit validation passed for team and global features.");
