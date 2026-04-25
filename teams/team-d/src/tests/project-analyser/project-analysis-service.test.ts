import test from 'node:test';
import assert from 'node:assert/strict';
import type { LLMContext, LLMPort, WorkspaceContextReaderPort } from '@omni/core';
import {
  ProjectAnalysisService,
  getDepthProfile,
  redactSensitiveText,
  supplementCodeAnalysis,
} from '../../features/project-analyser/project-analysis-service';

class FakeReader implements WorkspaceContextReaderPort {
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

class FakeLLM implements LLMPort {
  readonly provider = 'fake';
  readonly prompts: string[] = [];

  async sendPrompt(prompt: string, _context?: LLMContext): Promise<string> {
    this.prompts.push(prompt);
    if (prompt.startsWith('Analyse this monorepo\'s architecture')) {
      return JSON.stringify({
        summary: 'Architecture summary token=ghp_secretTokenValue1234567890',
        pattern: 'Hexagonal',
        layers: [{ name: 'core', members: ['@omni/core'], purpose: 'Domain logic', allowedDependencies: [] }],
        dependencies: [{ from: '@omni/team-d', to: '@omni/core' }],
        observations: ['Architecture observation'],
        diagram: 'graph TD\n  Core --> Adapter',
      });
    }
    if (prompt.startsWith('Analyse the deployment strategy')) {
      return JSON.stringify({
        summary: 'Deployment summary apiKey="very-secret-value"',
        toolchain: 'Turbo',
        pipeline: [],
        targets: ['VS Code'],
        observations: ['Deployment observation'],
        diagram: 'flowchart LR\n  Build --> Publish',
      });
    }
    if (prompt.startsWith('Identify and explain the key business and user flows')) {
      return JSON.stringify({
        flows: [{ name: 'Analyse workspace', owner: 'team-d', steps: ['Gather context', 'Render report'], description: 'Primary reporting flow' }],
        crossCuttingConcerns: ['Redaction'],
        diagram: 'flowchart TD\n  User --> Report',
      });
    }
    if (prompt.startsWith('Analyse the TypeScript source code below')) {
      return JSON.stringify({
        errorHandlingPatterns: [],
        controlFlowPatterns: [],
        keyConditions: [],
        useCases: [],
        technicalDebt: ['Improve source classification'],
        diagram: 'flowchart TD\n  Start --> End',
      });
    }

    return 'Executive summary github_pat_abcdefghijklmnopqrstuvwxyzABCDEFGHIJK should be redacted.';
  }
}

function createReader(): FakeReader {
  return new FakeReader(
    {
      'README.md': '# Repo',
      'docs/architecture.md': '# Architecture',
      'docs/deployment.md': '# Deployment',
      'turbo.json': '{"pipeline":{}}',
      'package.json': JSON.stringify({ name: 'root', version: '1.0.0', scripts: { build: 'turbo run build' } }),
      'packages/core/package.json': JSON.stringify({ name: '@omni/core', version: '1.0.0', dependencies: {} }),
      'teams/team-d/package.json': JSON.stringify({ name: '@omni/team-d', version: '1.0.0', dependencies: { '@omni/core': '*' } }),
      'teams/team-d/specs/001-project-analyser/spec.md': '# Spec',
      'docs/onboarding.md': '# Onboarding',
      'packages/core/src/index.ts': 'if (enabled) { return value; }\nthrow new Error("boom");',
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

test('generateProjectReportWithProgress assembles redacted report and ordered stages', async () => {
  const reader = createReader();
  const llm = new FakeLLM();
  const service = new ProjectAnalysisService(reader, llm);
  const stages: string[] = [];

  const report = await service.generateProjectReportWithProgress((stage) => stages.push(stage), { depth: 'standard' });

  assert.equal(report.architecture.pattern, 'Hexagonal');
  assert.equal(report.businessFlows.flows.length, 1);
  assert.ok(report.codeAnalysis.controlFlowPatterns.length > 0);
  assert.ok(report.codeAnalysis.errorHandlingPatterns.length > 0);
  assert.ok(report.codeAnalysis.useCases.length >= 2);
  assert.match(report.executiveSummary, /\[REDACTED\]/);
  assert.doesNotMatch(report.deployment.summary, /very-secret-value/);
  assert.equal(stages.join(','), 'gathering,architecture,deployment,flows,code,summary');
  assert.ok(report.globalToolingGaps.length >= 1);
  assert.ok(report.codeAnalysis.meta.limitations.some((item) => item.includes('Standard depth')));
});

test('deep depth prompts include adapter and team samples while shallow depth does not', async () => {
  const reader = createReader();
  const llm = new FakeLLM();
  const service = new ProjectAnalysisService(reader, llm);

  await service.analyzeCode({ depth: 'shallow' });
  const shallowPrompt = llm.prompts[0];
  assert.doesNotMatch(shallowPrompt, /packages\/adapters\/vscode\/src\/activate\.ts/);
  assert.doesNotMatch(shallowPrompt, /teams\/team-d\/src\/features\/project-analyser\/analysis-panel\.ts/);

  llm.prompts.length = 0;
  await service.analyzeCode({ depth: 'deep' });
  const deepPrompt = llm.prompts[0];
  assert.match(deepPrompt, /packages\/adapters\/vscode\/src\/activate\.ts/);
  assert.match(deepPrompt, /teams\/team-d\/src\/features\/project-analyser\/analysis-panel\.ts/);
});

test('testing helpers expose deterministic redaction, depth, and code-analysis supplementation', () => {
  assert.equal(getDepthProfile('shallow').sourceLimit, 6);
  assert.equal(redactSensitiveText('token=ghp_abcdefghijklmnopqrstuvwxyz123456'), '[REDACTED]');

  const supplemented = supplementCodeAnalysis(
    {
      errorHandlingPatterns: [],
      controlFlowPatterns: [],
      keyConditions: [],
      useCases: [],
      technicalDebt: [],
      diagram: 'flowchart TD\n  A --> B',
    },
    [{ relativePath: 'src/a.ts', content: 'if (enabled) { return x; }\ntry { throw new Error("x"); } catch (error) {}' }],
    [],
  );

  assert.ok(supplemented.controlFlowPatterns.length > 0);
  assert.ok(supplemented.errorHandlingPatterns.length > 0);
  assert.ok(supplemented.keyConditions.some((item) => item.includes('enabled')));
  assert.ok(supplemented.useCases.length >= 2);
});