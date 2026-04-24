const fs = require("fs");
const path = require("path");

function fail(message) {
  console.error(`❌ Spec validation failed: ${message}`);
  process.exit(1);
}

const root = path.resolve(__dirname, "..");
const teamsDir = path.join(root, "teams");

if (!fs.existsSync(teamsDir)) {
  fail("No teams directory found.");
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

  const files = fs.readdirSync(specsDir).filter((file) => {
    return [".json", ".md"].includes(path.extname(file));
  });

  if (files.length === 0) {
    console.error(`Team ${team} has no OpenSpec or BMAD files in specs/.`);
    errors += 1;
    continue;
  }

  for (const file of files) {
    const fullPath = path.join(specsDir, file);
    if (path.extname(file) === ".json") {
      try {
        JSON.parse(fs.readFileSync(fullPath, "utf8"));
      } catch (error) {
        console.error(`Team ${team} has invalid JSON in ${file}:`, error.message);
        errors += 1;
      }
    }
  }
}

if (errors > 0) {
  fail(`${errors} spec validation issue(s) found.`);
}

console.log("✅ SpecKit validation passed for all teams.");
