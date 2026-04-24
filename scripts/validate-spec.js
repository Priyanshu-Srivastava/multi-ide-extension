const fs = require("fs");
const path = require("path");

const REQUIRED_SPEC_JSON = "openspec.json";
const REQUIRED_SPECKIT_FILES = ["spec.md", "plan.md", "tasks.md", "research.md"];

function fail(message) {
  console.error(`❌ Spec validation failed: ${message}`);
  process.exit(1);
}

const root = path.resolve(__dirname, "..");
const teamsDir = path.join(root, "teams");
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

    try {
      const spec = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
      const expectedName = `@omni/${team}`;

      if (spec.name !== expectedName) {
        console.error(
          `Team ${team}, feature ${feature} has invalid spec name '${spec.name}'. Expected '${expectedName}'.`,
        );
        errors += 1;
      }

      if (!spec.version || typeof spec.version !== "string") {
        console.error(`Team ${team}, feature ${feature} is missing a valid string 'version'.`);
        errors += 1;
      }

      if (!Array.isArray(spec.tools)) {
        console.error(`Team ${team}, feature ${feature} is missing 'tools' array in ${REQUIRED_SPEC_JSON}.`);
        errors += 1;
      }
    } catch (error) {
      console.error(`Team ${team}, feature ${feature} has invalid JSON in ${REQUIRED_SPEC_JSON}:`, error.message);
      errors += 1;
    }
  }
}

if (errors > 0) {
  fail(`${errors} spec validation issue(s) found.`);
}

console.log("✅ SpecKit validation passed for all teams.");
