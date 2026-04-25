import test from 'node:test';
import assert from 'node:assert/strict';
import type { LLMContext, LLMPort, WorkspaceContextReaderPort } from '@omni/core';
import { ProjectAnalysisService } from '../../features/project-analyser/project-analysis-service';

class ValidationReader implements WorkspaceContextReaderPort {
  constructor(
    private readonly relativeFiles: Record<string, string>,
    private readonly searchResults: Record<string, string[]>,
  ) {}

  toRelative(absolutePath: string): string {
    return absolutePath.replace(/^C:[\\/]repo[\\/]/i, '').replace(/\\/g, '/');
  }

  async readRelative(relativePath: string): Promise<string | null> {
    return this.relativeFiles[relativePath] ?? null;
  }

  async findFiles(include: string): Promise<string[]> {
    return this.searchResults[include] ?? [];
  }

  async readMany(absolutePaths: string[]): Promise<Array<{ relativePath: string; content: string }>> {
    return absolutePaths
      .map((absolutePath) => {
        const relativePath = this.toRelative(absolutePath);
        const content = this.relativeFiles[relativePath];
        return content ? { relativePath, content } : null;
      })
      .filter((entry): entry is { relativePath: string; content: string } => entry !== null);
  }
}

class ValidationLLM implements LLMPort {
  readonly provider = 'validation';

  constructor(private readonly variant: number) {}

  async sendPrompt(prompt: string, _context?: LLMContext): Promise<string> {
    if (prompt.startsWith('Analyse this monorepo\'s architecture')) {
      return JSON.stringify({
        summary: `Architecture summary ${this.variant}`,
        pattern: 'Hexagonal',
        layers: [{ name: 'core', members: ['@omni/core'], purpose: 'Domain logic', allowedDependencies: [] }],
        dependencies: [{ from: '@omni/team-d', to: '@omni/core' }],
        observations: [`Architecture observation ${this.variant}`],
        diagram: 'graph TD\n  Core --> Adapter',
        meta: { confidence: 'high', limitations: [] },
      });
    }
    if (prompt.startsWith('Analyse the deployment strategy')) {
      return JSON.stringify({
        summary: `Deployment summary ${this.variant}`,
        toolchain: 'Turbo',
        pipeline: [
          { order: 1, label: 'Build', description: 'Build packages', type: 'build' },
          { order: 2, label: 'Publish', description: 'Publish artifacts', type: 'publish' },
        ],
        targets: ['VS Code'],
        observations: [`Deployment observation ${this.variant}`],
        diagram: 'flowchart LR\n  Build --> Publish',
        meta: { confidence: 'high', limitations: [] },
      });
    }
    if (prompt.startsWith('Identify and explain the key business and user flows')) {
      return JSON.stringify({
        flows: [
          { name: `Analyse workspace ${this.variant}`, owner: 'team-d', steps: ['Gather context', 'Render report'], description: 'Primary reporting flow' },
          { name: `Review deployment ${this.variant}`, owner: 'team-d', steps: ['Open deployment tab', 'Inspect pipeline'], description: 'Secondary flow' },
        ],
        crossCuttingConcerns: ['Redaction', 'Progress reporting'],
        diagram: 'flowchart TD\n  User --> Report',
        meta: { confidence: 'high', limitations: [] },
      });
    }
    if (prompt.startsWith('Analyse the TypeScript source code below')) {
      return JSON.stringify({
        errorHandlingPatterns: ['Validation errors are surfaced before report assembly.'],
        controlFlowPatterns: ['Conditional branching controls stage-specific rendering.'],
        keyConditions: ['Condition: report sections must be available before render'],
        useCases: [
          { name: `Generate analysis ${this.variant}`, trigger: 'User starts analysis', steps: ['Gather files', 'Generate report'], outcomes: ['Report visible'] },
          { name: `Retry analysis ${this.variant}`, trigger: 'User retries after error', steps: ['Reuse last params', 'Rerun analysis'], outcomes: ['Successful rerun'] },
        ],
        technicalDebt: [],
        diagram: 'flowchart TD\n  Start --> End',
        meta: { confidence: 'high', limitations: [] },
      });
    }

    return `Executive summary ${this.variant}`;
  }
}

function createReader(seed: number): ValidationReader {
  return new ValidationReader(
    {
      'README.md': `# Repo ${seed}`,
      'docs/architecture.md': '# Architecture',
      'docs/deployment.md': '# Deployment',
      'docs/onboarding.md': '# Onboarding',
      'turbo.json': '{"pipeline":{}}',
      'package.json': JSON.stringify({ name: 'root', version: '1.0.0', scripts: { build: 'turbo run build' } }),
      'packages/core/package.json': JSON.stringify({ name: '@omni/core', version: '1.0.0', dependencies: {} }),
      'teams/team-d/package.json': JSON.stringify({ name: '@omni/team-d', version: '1.0.0', dependencies: { '@omni/core': '*' } }),
      'teams/team-d/specs/001-project-analyser/spec.md': '# Spec',
      'packages/core/src/index.ts': 'if (enabled) { return value; }\ntry { throw new Error("boom"); } catch (error) {}',
      'packages/core/src/errors/sample.ts': 'export class SampleError extends Error {}',
      'packages/adapters/vscode/src/activate.ts': 'switch (mode) { case "x": break; }',
      'teams/team-d/src/features/project-analyser/analysis-panel.ts': 'if (msg.error) { return; }',
      'scripts/build.js': 'console.log("build")',
      'manifests/unified-vscode.json': '{"name":"vscode"}',
    },
    {
      '**/package.json': ['C:/repo/package.json', 'C:/repo/packages/core/package.json', 'C:/repo/teams/team-d/package.json'],
      'scripts/**': ['C:/repo/scripts/build.js'],
      'manifests/**/*.json': ['C:/repo/manifests/unified-vscode.json'],
      '**/specs/**/*.md': ['C:/repo/teams/team-d/specs/001-project-analyser/spec.md'],
      'docs/**/*.md': ['C:/repo/docs/architecture.md', 'C:/repo/docs/onboarding.md'],
      'packages/core/src/**/*.ts': ['C:/repo/packages/core/src/index.ts'],
      'packages/core/src/errors/**/*.ts': ['C:/repo/packages/core/src/errors/sample.ts'],
      'packages/adapters/vscode/src/**/*.ts': ['C:/repo/packages/adapters/vscode/src/activate.ts'],
      'teams/team-d/src/**/*.ts': ['C:/repo/teams/team-d/src/features/project-analyser/analysis-panel.ts'],
    },
  );
}

test('validation proxy covers five representative report runs', async () => {
  let comprehensionChecks = 0;
  let comprehensionPassed = 0;

  for (let variant = 0; variant < 5; variant += 1) {
    const service = new ProjectAnalysisService(createReader(variant), new ValidationLLM(variant));
    const report = await service.generateProjectReport({ depth: 'standard' });

    assert.ok(report.executiveSummary.length > 0);
    assert.ok(report.architecture.diagram);
    assert.ok(report.businessFlows.diagram);
    assert.ok(report.deployment.pipeline.length >= 2);
    assert.ok(report.codeAnalysis.useCases.length >= 2);
    assert.ok(report.codeAnalysis.keyConditions.length >= 1);
    assert.equal(report.architecture.meta.confidence, 'high');
    assert.equal(report.deployment.meta.confidence, 'high');
    assert.equal(report.businessFlows.meta.confidence, 'high');
    assert.equal(report.codeAnalysis.meta.confidence, 'high');

    comprehensionChecks += 2;
    if (report.architecture.pattern === 'Hexagonal') {
      comprehensionPassed += 1;
    }
    if (report.businessFlows.flows[0]?.name === `Analyse workspace ${variant}`) {
      comprehensionPassed += 1;
    }
  }

  assert.equal(comprehensionChecks, 10);
  assert.ok((comprehensionPassed / comprehensionChecks) * 100 >= 85);
});