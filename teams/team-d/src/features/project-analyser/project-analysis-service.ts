import * as path from 'path';
import type { LLMPort, LLMContext } from '@omni/core';
import type {
  ProjectAnalysisPort,
  WorkspaceContextReaderPort,
  AnalysisOptions,
  ProjectAnalysis,
  DeploymentAnalysis,
  BusinessFlowAnalysis,
  CodeAnalysis,
  ProjectReport,
  PackageInfo,
  ArchitectureLayer,
  DependencyEdge,
  DeploymentStep,
  BusinessFlow,
  UseCase,
  AnalysisSectionMeta,
  GlobalToolingGap,
} from '@omni/core';

// ---------------------------------------------------------------------------
// Types matching LLM JSON output
// ---------------------------------------------------------------------------

type LLMArchResult = {
  summary: string;
  pattern: string;
  layers: ArchitectureLayer[];
  dependencies: DependencyEdge[];
  observations: string[];
  diagram: string;
  meta?: AnalysisSectionMeta;
};

type LLMDeployResult = {
  summary: string;
  toolchain: string;
  pipeline: DeploymentStep[];
  targets: string[];
  observations: string[];
  diagram: string;
  meta?: AnalysisSectionMeta;
};

type LLMFlowResult = {
  flows: BusinessFlow[];
  crossCuttingConcerns: string[];
  diagram: string;
  meta?: AnalysisSectionMeta;
};

type LLMCodeResult = {
  errorHandlingPatterns: string[];
  controlFlowPatterns: string[];
  keyConditions: string[];
  useCases: UseCase[];
  technicalDebt: string[];
  diagram: string;
  meta?: AnalysisSectionMeta;
};

export interface AnalysisDepthProfile {
  depth: NonNullable<AnalysisOptions['depth']>;
  packageLimit: number;
  scriptLimit: number;
  manifestLimit: number;
  specLimit: number;
  docLimit: number;
  sourceLimit: number;
  includeArchitectureSources: boolean;
  includeFlowSources: boolean;
  includeAdapterSources: boolean;
  includeTeamSources: boolean;
  limitationNote: string;
}

const DEPTH_PROFILES: Record<NonNullable<AnalysisOptions['depth']>, AnalysisDepthProfile> = {
  shallow: {
    depth: 'shallow',
    packageLimit: 12,
    scriptLimit: 6,
    manifestLimit: 6,
    specLimit: 4,
    docLimit: 6,
    sourceLimit: 6,
    includeArchitectureSources: false,
    includeFlowSources: false,
    includeAdapterSources: false,
    includeTeamSources: false,
    limitationNote: 'Shallow depth samples only top-level docs, manifests, and a small package set.',
  },
  standard: {
    depth: 'standard',
    packageLimit: 30,
    scriptLimit: 20,
    manifestLimit: 20,
    specLimit: 30,
    docLimit: 20,
    sourceLimit: 15,
    includeArchitectureSources: false,
    includeFlowSources: false,
    includeAdapterSources: false,
    includeTeamSources: false,
    limitationNote: 'Standard depth samples shared docs, manifests, specs, and representative source files.',
  },
  deep: {
    depth: 'deep',
    packageLimit: 60,
    scriptLimit: 40,
    manifestLimit: 40,
    specLimit: 60,
    docLimit: 40,
    sourceLimit: 30,
    includeArchitectureSources: true,
    includeFlowSources: true,
    includeAdapterSources: true,
    includeTeamSources: true,
    limitationNote: 'Deep depth includes broader source sampling across adapters and team feature folders.',
  },
};

const SECRET_PATTERNS: RegExp[] = [
  /\b(?:ghp|gho|github_pat)_[A-Za-z0-9_]{20,}\b/g,
  /\b(?:xoxb|xoxp|xoxa)-[A-Za-z0-9-]{20,}\b/g,
  /\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*["']?[^"'\s]{6,}/gi,
  /\bAKIA[0-9A-Z]{16}\b/g,
];

// ---------------------------------------------------------------------------
// Helper — call LLM and attempt JSON parse, strip markdown fences if present
// ---------------------------------------------------------------------------

async function promptJson<T>(
  llm: LLMPort,
  prompt: string,
  options: AnalysisOptions,
): Promise<{ parsed: T | null; raw: string }> {
  const ctx: LLMContext = {
    systemInstruction:
      'You are a senior software engineer performing a deep codebase analysis. ' +
      'Always respond with a single valid JSON object — no markdown code fences, ' +
      'no prose outside the JSON. Every string field must be concise but informative. ' +
      'Mermaid diagram fields must contain valid Mermaid syntax only.',
  };
  if (options.modelOverride) {
    (ctx as LLMContext & { options?: Record<string, unknown> }).options = {
      model: options.modelOverride,
    };
  }

  const raw = await llm.sendPrompt(prompt, ctx);
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  try {
    return { parsed: JSON.parse(cleaned) as T, raw };
  } catch {
    return { parsed: null, raw };
  }
}

// ---------------------------------------------------------------------------
// Context helpers — what to read per analysis type
// ---------------------------------------------------------------------------

async function readPackages(reader: WorkspaceContextReaderPort): Promise<PackageInfo[]> {
  const pkgPaths = await reader.findFiles('**/package.json', '**/node_modules/**', 30);
  const files = await reader.readMany(pkgPaths);
  return files
    .map((f) => {
      try {
        const pkg = JSON.parse(f.content) as {
          name?: string; version?: string; description?: string;
          dependencies?: Record<string, string>; devDependencies?: Record<string, string>;
          scripts?: Record<string, string>;
        };
        return {
          name: pkg.name ?? path.dirname(f.relativePath),
          version: pkg.version ?? '0.0.0',
          relativePath: f.relativePath,
          description: pkg.description,
          dependencies: { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) },
          scripts: pkg.scripts ?? {},
        } as PackageInfo;
      } catch {
        return null;
      }
    })
    .filter((p): p is PackageInfo => p !== null);
}

function isInScope(relativePath: string, scope?: string[]): boolean {
  if (!scope || scope.length === 0) return true;
  const normalized = relativePath.replace(/\\/g, '/').toLowerCase();
  return scope.some((s) => normalized.includes(s.replace(/\\/g, '/').toLowerCase()));
}

function filterPathsByScope(reader: WorkspaceContextReaderPort, absolutePaths: string[], scope?: string[]): string[] {
  if (!scope || scope.length === 0) return absolutePaths;
  return absolutePaths.filter((p) => isInScope(reader.toRelative(p), scope));
}

export function getDepthProfile(depth: AnalysisOptions['depth'] = 'standard'): AnalysisDepthProfile {
  return DEPTH_PROFILES[depth ?? 'standard'];
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function defaultMeta(fallbackLimitation: string, depthLimitation: string): AnalysisSectionMeta {
  return { confidence: 'medium', limitations: unique([fallbackLimitation, depthLimitation]) };
}

export function mergeSectionMeta(
  meta: AnalysisSectionMeta | undefined,
  fallbackLimitation: string,
  depthLimitation: string,
): AnalysisSectionMeta {
  if (!meta) return defaultMeta(fallbackLimitation, depthLimitation);
  const confidence = meta.confidence ?? 'medium';
  const limitations = meta.limitations && meta.limitations.length > 0
    ? unique([...meta.limitations, depthLimitation])
    : unique([fallbackLimitation, depthLimitation]);
  return { confidence, limitations };
}

export function redactSensitiveText(value: string): string {
  let sanitized = value;
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  return sanitized;
}

function redactStringArray(values: string[]): string[] {
  return values.map((v) => redactSensitiveText(v));
}

function sampleContents(
  files: Array<{ relativePath: string; content: string }>,
  limit: number,
): Array<{ relativePath: string; content: string }> {
  return files.slice(0, limit);
}

function discoverGlobalToolingGaps(report: {
  deployment: DeploymentAnalysis;
  codeAnalysis: CodeAnalysis;
}): GlobalToolingGap[] {
  const gaps: GlobalToolingGap[] = [];

  if (report.deployment.pipeline.length === 0) {
    gaps.push({
      title: 'Deployment Pipeline Extraction Tooling',
      rationale: 'Deployment analysis returned no pipeline steps; this is likely to recur across teams.',
      expectedContract: 'A shared tool to parse CI/CD config and scripts into normalized deployment steps.',
    });
  }

  if (report.codeAnalysis.controlFlowPatterns.length === 0 && report.codeAnalysis.useCases.length === 0) {
    gaps.push({
      title: 'Structured Control-Flow Extraction Tooling',
      rationale: 'Code analysis could not reliably extract control-flow/use-cases from source.',
      expectedContract: 'A shared static-analysis tool that emits control-flow nodes, branches, and use-case candidates.',
    });
  }

  return gaps;
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildArchitecturePrompt(
  packages: PackageInfo[],
  readme: string,
  archDoc: string,
  turbo: string,
  sourceSamples: Array<{ relativePath: string; content: string }>,
  profile: AnalysisDepthProfile,
): string {
  const pkgList = packages
    .map((p) => `• ${p.name}@${p.version} (${p.relativePath})${p.description ? ` — ${p.description}` : ''}`)
    .join('\n');

  const internalEdges = packages
    .flatMap((p) =>
      Object.keys(p.dependencies)
        .filter((dep) => packages.some((q) => q.name === dep))
        .map((dep) => `  ${p.name} → ${dep}`),
    )
    .join('\n');

  const sourceText = sourceSamples.length > 0
    ? sourceSamples.map((f) => `### ${f.relativePath}\n${f.content.slice(0, 350)}`).join('\n\n')
    : '(none sampled for this depth)';

  return `Analyse this monorepo's architecture and return a JSON object.

Depth mode: ${profile.depth}. ${profile.limitationNote}

## Packages
${pkgList}

## Internal dependency graph
${internalEdges || '(none detected)'}

## README (first 2000 chars)
${readme.slice(0, 2000)}

## Architecture documentation
${archDoc.slice(0, 3000)}

## Turborepo config
${turbo.slice(0, 800)}

## Representative source samples
${sourceText.slice(0, 1500)}

Return ONLY this JSON shape:
{
  "summary": "<overall architecture narrative, 2-4 sentences>",
  "pattern": "<architecture style name>",
  "layers": [
    { "name": "...", "members": ["pkg-name"], "purpose": "...", "allowedDependencies": ["layer-name"] }
  ],
  "dependencies": [{ "from": "pkg-a", "to": "pkg-b" }],
  "observations": ["<key observation>"],
  "diagram": "graph TD\\n  A[core] --> B[adapters]\\n  ...",
  "meta": { "confidence": "high|medium|low", "limitations": ["..."] }
}`;
}

function buildDeploymentPrompt(
  deployDoc: string,
  scripts: Array<{ relativePath: string; content: string }>,
  packageScripts: Record<string, Record<string, string>>,
  manifests: Array<{ relativePath: string; content: string }>,
  profile: AnalysisDepthProfile,
): string {
  const scriptsText = scripts.map((f) => `### ${f.relativePath}\n${f.content.slice(0, 600)}`).join('\n\n');
  const pkgScriptsText = Object.entries(packageScripts)
    .map(([name, s]) => `${name}: ${JSON.stringify(s)}`)
    .join('\n');
  const manifestText = manifests.map((f) => `### ${f.relativePath}\n${f.content.slice(0, 300)}`).join('\n\n');

  return `Analyse the deployment strategy of this monorepo and return a JSON object.

Depth mode: ${profile.depth}. ${profile.limitationNote}

## Deployment docs
${deployDoc.slice(0, 2000)}

## Build/deploy scripts
${scriptsText.slice(0, 2500)}

## Package scripts
${pkgScriptsText.slice(0, 1200)}

## Manifests
${manifestText.slice(0, 1000)}

Return ONLY this JSON shape:
{
  "summary": "<deployment strategy narrative, 2-4 sentences>",
  "toolchain": "<CI/CD toolchain name>",
  "pipeline": [
    { "order": 1, "label": "...", "description": "...", "type": "build|test|package|publish|deploy" }
  ],
  "targets": ["<target environment>"],
  "observations": ["<observation or risk>"],
  "diagram": "flowchart LR\\n  Build --> Test --> Package --> Publish\\n  ...",
  "meta": { "confidence": "high|medium|low", "limitations": ["..."] }
}`;
}

function buildBusinessFlowPrompt(
  specs: Array<{ relativePath: string; content: string }>,
  docs: Array<{ relativePath: string; content: string }>,
  readme: string,
  sourceSamples: Array<{ relativePath: string; content: string }>,
  profile: AnalysisDepthProfile,
): string {
  const specsText = specs.map((f) => `### ${f.relativePath}\n${f.content.slice(0, 800)}`).join('\n\n');
  const docsText = docs.map((f) => `### ${f.relativePath}\n${f.content.slice(0, 600)}`).join('\n\n');
  const sourceText = sourceSamples.map((f) => `### ${f.relativePath}\n${f.content.slice(0, 350)}`).join('\n\n');

  return `Identify and explain the key business and user flows in this codebase. Return a JSON object.

Depth mode: ${profile.depth}. ${profile.limitationNote}

## README
${readme.slice(0, 1500)}

## Specs
${specsText.slice(0, 3000)}

## Documentation
${docsText.slice(0, 2000)}

## Representative source samples
${sourceText.slice(0, 1200) || '(none sampled for this depth)'}

Return ONLY this JSON shape:
{
  "flows": [
    {
      "name": "<flow name>",
      "owner": "<team or package>",
      "steps": ["step 1", "step 2"],
      "description": "<narrative explanation>"
    }
  ],
  "crossCuttingConcerns": ["<concern>"],
  "diagram": "flowchart TD\\n  User-->|triggers|FlowA\\n  ...",
  "meta": { "confidence": "high|medium|low", "limitations": ["..."] }
}`;
}

function buildCodeAnalysisPrompt(
  sources: Array<{ relativePath: string; content: string }>,
  errorFiles: Array<{ relativePath: string; content: string }>,
  profile: AnalysisDepthProfile,
): string {
  const sourceText = sources.map((f) => `### ${f.relativePath}\n${f.content.slice(0, 500)}`).join('\n\n');
  const errorText = errorFiles.map((f) => `### ${f.relativePath}\n${f.content.slice(0, 400)}`).join('\n\n');

  return `Analyse the TypeScript source code below for control flow, error handling, conditions, and use cases. Return a JSON object.

Depth mode: ${profile.depth}. ${profile.limitationNote}

## Core source files
${sourceText.slice(0, 3500)}

## Error definitions
${errorText.slice(0, 1000)}

Focus on:
- decision points and their branch outcomes
- explicit error classifications (validation, network, configuration, internal, user-driven)
- guard clauses and conditions that materially change behavior
- at least two use cases when the sampled code supports them

Return ONLY this JSON shape:
{
  "errorHandlingPatterns": ["<pattern description>"],
  "controlFlowPatterns": ["<pattern description>"],
  "keyConditions": ["<significant condition or guard clause>"],
  "useCases": [
    {
      "name": "<use case name>",
      "trigger": "<what initiates this>",
      "steps": ["step 1", "step 2"],
      "outcomes": ["success outcome", "failure outcome"]
    }
  ],
  "technicalDebt": ["<debt item or improvement opportunity>"],
  "diagram": "flowchart TD\\n  Start --> Condition{...}\\n  Condition-->|yes|PathA\\n  Condition-->|no|PathB\\n  ...",
  "meta": { "confidence": "high|medium|low", "limitations": ["..."] }
}`;
}

function buildExecutiveSummaryPrompt(
  arch: ProjectAnalysis,
  deploy: DeploymentAnalysis,
  flows: BusinessFlowAnalysis,
  code: CodeAnalysis,
): string {
  return `Write a concise executive summary (4–6 sentences) for a technical project report. Use plain text only — no JSON, no markdown.

Architecture: ${arch.summary} Pattern: ${arch.pattern}.
Deployment: ${deploy.summary} Toolchain: ${deploy.toolchain}.
Business flows: ${flows.flows.map((f) => f.name).join(', ')}.
Key use cases: ${code.useCases.map((u) => u.name).join(', ')}.
Technical debt items: ${code.technicalDebt.length}.`;
}

// ---------------------------------------------------------------------------
// Fallbacks — used when LLM returns unparseable output
// ---------------------------------------------------------------------------

const fallbackArch = (packages: PackageInfo[], raw: string): ProjectAnalysis => ({
  summary: raw.slice(0, 300), pattern: 'Unknown', layers: [], packages,
  dependencies: [], observations: ['LLM response could not be parsed.'],
  meta: { confidence: 'low', limitations: ['LLM response could not be parsed as structured JSON.'] },
  rawResponse: raw,
});

const fallbackDeploy = (raw: string): DeploymentAnalysis => ({
  summary: raw.slice(0, 300), toolchain: 'Unknown', pipeline: [], targets: [],
  observations: ['LLM response could not be parsed.'],
  meta: { confidence: 'low', limitations: ['LLM response could not be parsed as structured JSON.'] },
  rawResponse: raw,
});

const fallbackFlows = (raw: string): BusinessFlowAnalysis => ({
  flows: [], crossCuttingConcerns: [],
  meta: { confidence: 'low', limitations: ['LLM response could not be parsed as structured JSON.'] },
  rawResponse: raw,
});

const fallbackCode = (raw: string): CodeAnalysis => ({
  errorHandlingPatterns: [], controlFlowPatterns: [], keyConditions: [],
  useCases: [], technicalDebt: ['LLM response could not be parsed.'],
  meta: { confidence: 'low', limitations: ['LLM response could not be parsed as structured JSON.'] },
  rawResponse: raw,
});

function collectControlFlowPatterns(contents: string[]): string[] {
  const patterns: string[] = [];
  if (contents.some((content) => /\bif\s*\(/.test(content))) {
    patterns.push('Conditional branching through `if` statements controls alternate execution paths.');
  }
  if (contents.some((content) => /\bswitch\s*\(/.test(content))) {
    patterns.push('`switch` statements classify behavior into discrete outcome branches.');
  }
  if (contents.some((content) => /\bPromise\.all\b|await\s+Promise\.all/.test(content))) {
    patterns.push('Concurrent asynchronous fan-out is used to gather context before synthesis.');
  }
  return patterns;
}

function collectErrorHandlingPatterns(contents: string[]): string[] {
  const patterns: string[] = [];
  if (contents.some((content) => /\btry\s*\{[\s\S]*?\bcatch\s*\(/.test(content))) {
    patterns.push('Exceptions are normalized through `try/catch` blocks before surfacing recoverable errors.');
  }
  if (contents.some((content) => /throw new Error|throw new /.test(content))) {
    patterns.push('Internal failures are escalated with explicit thrown errors.');
  }
  if (contents.some((content) => /\breturn\s+null\b|\?\?\s*null/.test(content))) {
    patterns.push('Missing context is handled with null-safe fallbacks rather than immediate failure.');
  }
  return patterns;
}

function collectKeyConditions(contents: string[]): string[] {
  const matches = contents
    .flatMap((content) => Array.from(content.matchAll(/\b(?:if|else if)\s*\(([^)]+)\)/g)).map((match) => match[1].trim()))
    .slice(0, 8)
    .map((condition) => `Condition: ${condition}`);
  return unique(matches);
}

function defaultUseCases(): UseCase[] {
  return [
    {
      name: 'Generate repository analysis report',
      trigger: 'A user runs the Project Analyser from the Team D panel.',
      steps: [
        'Gather workspace files through the shared reader abstraction.',
        'Analyse architecture, deployment, business flows, and code behavior.',
        'Assemble a structured report with diagrams, confidence, and limitations.',
      ],
      outcomes: ['A sectioned report is displayed.', 'Recoverable failures are surfaced for retry.'],
    },
    {
      name: 'Review generated report sections',
      trigger: 'A user opens a completed report and switches between tabs.',
      steps: [
        'Inspect the overview and architecture findings.',
        'Drill into flows, deployment, and code analysis tabs.',
        'Use confidence and limitation notes to judge uncertain findings.',
      ],
      outcomes: ['Users can navigate without rerunning analysis.', 'Low-confidence inferences remain visible and bounded.'],
    },
  ];
}

export function supplementCodeAnalysis(
  parsed: LLMCodeResult,
  sources: Array<{ relativePath: string; content: string }>,
  errorFiles: Array<{ relativePath: string; content: string }>,
): LLMCodeResult {
  const sourceContents = sources.map((source) => source.content);
  const errorContents = errorFiles.map((file) => file.content);
  const controlFlowPatterns = unique([
    ...(parsed.controlFlowPatterns ?? []),
    ...collectControlFlowPatterns(sourceContents),
  ]);
  const errorHandlingPatterns = unique([
    ...(parsed.errorHandlingPatterns ?? []),
    ...collectErrorHandlingPatterns([...sourceContents, ...errorContents]),
  ]);
  const keyConditions = unique([
    ...(parsed.keyConditions ?? []),
    ...collectKeyConditions(sourceContents),
  ]);
  const useCases = parsed.useCases && parsed.useCases.length > 0 ? parsed.useCases : defaultUseCases();

  return {
    ...parsed,
    controlFlowPatterns,
    errorHandlingPatterns,
    keyConditions,
    useCases,
  };
}

export type ProjectAnalysisStage =
  | 'gathering'
  | 'architecture'
  | 'deployment'
  | 'flows'
  | 'code'
  | 'summary';

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Team D's implementation of `ProjectAnalysisPort`.
 *
 * Orchestrates `WorkspaceReader` (infrastructure) and `LLMPort` (AI) to
 * produce structured project analysis. All prompt engineering and result
 * parsing lives here — in the feature folder, not in the adapter.
 */
export class ProjectAnalysisService implements ProjectAnalysisPort {
  constructor(
    private readonly reader: WorkspaceContextReaderPort,
    private readonly llm: LLMPort,
  ) {}

  async analyzeArchitecture(options: AnalysisOptions = {}): Promise<ProjectAnalysis> {
    const profile = getDepthProfile(options.depth);
    const scope = options.scope;
    const packages = (await readPackages(this.reader))
      .filter((p) => isInScope(p.relativePath, scope))
      .slice(0, profile.packageLimit);
    const architectureSourcePaths = profile.includeArchitectureSources
      ? filterPathsByScope(
        this.reader,
        await this.reader.findFiles('teams/team-d/src/**/*.ts', '**/node_modules/**', profile.sourceLimit),
        scope,
      )
      : [];
    const [readme, archDoc, turbo, architectureSources] = await Promise.all([
      this.reader.readRelative('README.md'),
      this.reader.readRelative('docs/architecture.md'),
      this.reader.readRelative('turbo.json'),
      this.reader.readMany(architectureSourcePaths.slice(0, profile.sourceLimit)),
    ]);

    const prompt = buildArchitecturePrompt(
      packages,
      readme ?? '',
      archDoc ?? '',
      turbo ?? '',
      sampleContents(architectureSources, profile.sourceLimit),
      profile,
    );
    const { parsed, raw } = await promptJson<LLMArchResult>(this.llm, prompt, options);
    if (!parsed) return fallbackArch(packages, raw);

    return {
      summary: redactSensitiveText(parsed.summary ?? ''),
      pattern: parsed.pattern ?? 'Unknown',
      layers: parsed.layers ?? [],
      packages,
      dependencies: parsed.dependencies ?? [],
      observations: redactStringArray(parsed.observations ?? []),
      diagram: parsed.diagram,
      meta: mergeSectionMeta(parsed.meta, 'Architecture derived from sampled files and may omit runtime-only behavior.', profile.limitationNote),
      rawResponse: redactSensitiveText(raw),
    };
  }

  async describeDeployment(options: AnalysisOptions = {}): Promise<DeploymentAnalysis> {
    const profile = getDepthProfile(options.depth);
    const scope = options.scope;
    const [deployDoc, scriptPathsRaw, manifestPathsRaw, pkgPathsRaw] = await Promise.all([
      this.reader.readRelative('docs/deployment.md'),
      this.reader.findFiles('scripts/**', '**/node_modules/**', profile.scriptLimit),
      this.reader.findFiles('manifests/**/*.json', '**/node_modules/**', profile.manifestLimit),
      this.reader.findFiles('**/package.json', '**/node_modules/**', profile.packageLimit),
    ]);

    const scriptPaths = filterPathsByScope(this.reader, scriptPathsRaw, scope);
    const manifestPaths = filterPathsByScope(this.reader, manifestPathsRaw, scope);
    const pkgPaths = filterPathsByScope(this.reader, pkgPathsRaw, scope);

    const [scripts, manifests, pkgFiles] = await Promise.all([
      this.reader.readMany(scriptPaths),
      this.reader.readMany(manifestPaths),
      this.reader.readMany(pkgPaths),
    ]);

    const packageScripts: Record<string, Record<string, string>> = {};
    for (const f of pkgFiles) {
      try {
        const pkg = JSON.parse(f.content) as { name?: string; scripts?: Record<string, string> };
        if (pkg.name && pkg.scripts && Object.keys(pkg.scripts).length > 0) {
          packageScripts[pkg.name] = pkg.scripts;
        }
      } catch { /* skip malformed */ }
    }

    const prompt = buildDeploymentPrompt(deployDoc ?? '', scripts, packageScripts, manifests, profile);
    const { parsed, raw } = await promptJson<LLMDeployResult>(this.llm, prompt, options);
    if (!parsed) return fallbackDeploy(raw);

    return {
      summary: redactSensitiveText(parsed.summary ?? ''),
      toolchain: parsed.toolchain ?? 'Unknown',
      pipeline: parsed.pipeline ?? [],
      targets: redactStringArray(parsed.targets ?? []),
      observations: redactStringArray(parsed.observations ?? []),
      diagram: parsed.diagram,
      meta: mergeSectionMeta(parsed.meta, 'Deployment strategy inferred from scripts/docs and may miss external pipeline steps.', profile.limitationNote),
      rawResponse: redactSensitiveText(raw),
    };
  }

  async explainBusinessFlows(options: AnalysisOptions = {}): Promise<BusinessFlowAnalysis> {
    const profile = getDepthProfile(options.depth);
    const scope = options.scope;
    const [specPathsRaw, docPathsRaw, sourcePathsRaw, readme] = await Promise.all([
      this.reader.findFiles('**/specs/**/*.md', '**/node_modules/**', profile.specLimit),
      this.reader.findFiles('docs/**/*.md', '**/node_modules/**', profile.docLimit),
      profile.includeFlowSources
        ? this.reader.findFiles('teams/team-d/src/**/*.ts', '**/node_modules/**', profile.sourceLimit)
        : Promise.resolve([]),
      this.reader.readRelative('README.md'),
    ]);

    const specPaths = filterPathsByScope(this.reader, specPathsRaw, scope);
    const docPaths = filterPathsByScope(this.reader, docPathsRaw, scope);
    const sourcePaths = filterPathsByScope(this.reader, sourcePathsRaw, scope);

    const [specs, docs, sources] = await Promise.all([
      this.reader.readMany(specPaths),
      this.reader.readMany(docPaths),
      this.reader.readMany(sourcePaths.slice(0, profile.sourceLimit)),
    ]);

    const prompt = buildBusinessFlowPrompt(specs, docs, readme ?? '', sampleContents(sources, profile.sourceLimit), profile);
    const { parsed, raw } = await promptJson<LLMFlowResult>(this.llm, prompt, options);
    if (!parsed) return fallbackFlows(raw);

    return {
      flows: (parsed.flows ?? []).map((f) => ({
        ...f,
        name: redactSensitiveText(f.name),
        owner: redactSensitiveText(f.owner),
        description: redactSensitiveText(f.description),
        steps: redactStringArray(f.steps ?? []),
      })),
      crossCuttingConcerns: redactStringArray(parsed.crossCuttingConcerns ?? []),
      diagram: parsed.diagram,
      meta: mergeSectionMeta(parsed.meta, 'Business flows inferred from docs/specs and may miss undocumented runtime paths.', profile.limitationNote),
      rawResponse: redactSensitiveText(raw),
    };
  }

  async analyzeCode(options: AnalysisOptions = {}): Promise<CodeAnalysis> {
    const profile = getDepthProfile(options.depth);
    const maxSrc = profile.sourceLimit;
    const scope = options.scope;

    const [corePathsRaw, errorPathsRaw] = await Promise.all([
      this.reader.findFiles('packages/core/src/**/*.ts', '**/node_modules/**', maxSrc),
      this.reader.findFiles('packages/core/src/errors/**/*.ts', '**/node_modules/**', 5),
    ]);

    const adapterPathsRaw = profile.includeAdapterSources
      ? await this.reader.findFiles('packages/adapters/vscode/src/**/*.ts', '**/node_modules/**', 15)
      : [];
    const teamPathsRaw = profile.includeTeamSources
      ? await this.reader.findFiles('teams/team-d/src/**/*.ts', '**/node_modules/**', 15)
      : [];

    const corePaths = filterPathsByScope(this.reader, corePathsRaw, scope);
    const errorPaths = filterPathsByScope(this.reader, errorPathsRaw, scope);
    const adapterPaths = filterPathsByScope(this.reader, adapterPathsRaw, scope);
    const teamPaths = filterPathsByScope(this.reader, teamPathsRaw, scope);

    const [sources, errorFiles] = await Promise.all([
      this.reader.readMany([...corePaths, ...adapterPaths, ...teamPaths].slice(0, maxSrc)),
      this.reader.readMany(errorPaths),
    ]);

    const prompt = buildCodeAnalysisPrompt(sources, errorFiles, profile);
    const { parsed, raw } = await promptJson<LLMCodeResult>(this.llm, prompt, options);
    if (!parsed) return fallbackCode(raw);
    const supplemented = supplementCodeAnalysis(parsed, sources, errorFiles);

    return {
      errorHandlingPatterns: redactStringArray(supplemented.errorHandlingPatterns ?? []),
      controlFlowPatterns: redactStringArray(supplemented.controlFlowPatterns ?? []),
      keyConditions: redactStringArray(supplemented.keyConditions ?? []),
      useCases: (supplemented.useCases ?? []).map((u) => ({
        ...u,
        name: redactSensitiveText(u.name),
        trigger: redactSensitiveText(u.trigger),
        steps: redactStringArray(u.steps ?? []),
        outcomes: redactStringArray(u.outcomes ?? []),
      })),
      technicalDebt: redactStringArray(supplemented.technicalDebt ?? []),
      diagram: supplemented.diagram,
      meta: mergeSectionMeta(supplemented.meta, 'Code analysis is sample-based and may miss dynamic/runtime execution paths.', profile.limitationNote),
      rawResponse: redactSensitiveText(raw),
    };
  }

  async generateProjectReport(options: AnalysisOptions = {}): Promise<ProjectReport> {
    return this.generateProjectReportWithProgress(() => {
      // No-op callback for non-interactive callers
    }, options);
  }

  async generateProjectReportWithProgress(
    onProgress: (stage: ProjectAnalysisStage, message: string, percent: number) => void,
    options: AnalysisOptions = {},
  ): Promise<ProjectReport> {
    onProgress('gathering', 'Scanning workspace files…', 5);
    const architecture = await this.analyzeArchitecture(options);
    onProgress('architecture', 'Architecture analysed', 30);

    const deployment = await this.describeDeployment(options);
    onProgress('deployment', 'Deployment strategy analysed', 52);

    const businessFlows = await this.explainBusinessFlows(options);
    onProgress('flows', 'Business flows mapped', 70);

    const codeAnalysis = await this.analyzeCode(options);
    onProgress('code', 'Code analysis complete', 88);

    const summaryPrompt = buildExecutiveSummaryPrompt(architecture, deployment, businessFlows, codeAnalysis);
    const executiveSummary = await this.llm.sendPrompt(summaryPrompt, {
      systemInstruction: 'You are a technical writer. Respond with plain text only — no markdown, no JSON.',
    });

    onProgress('summary', 'Generating report…', 96);

    return {
      generatedAt: new Date().toISOString(),
      architecture,
      deployment,
      businessFlows,
      codeAnalysis,
      globalToolingGaps: discoverGlobalToolingGaps({ deployment, codeAnalysis }),
      executiveSummary: redactSensitiveText(executiveSummary),
    };
  }
}
