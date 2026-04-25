/**
 * Pure domain types for project analysis results.
 *
 * These types are IDE-agnostic. They are produced by the analysis service
 * (implemented in the VS Code adapter) and consumed by team feature code.
 * No vscode / mcp / node imports are allowed here.
 */

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface AnalysisOptions {
  /** Override the LLM model for this specific analysis (e.g. 'gpt-4o'). */
  modelOverride?: string;
  /**
   * How deeply to gather context before prompting.
   * 'shallow' — read only top-level files (README, root package.json).
   * 'standard' — default; read docs, manifests, package.json files.
   * 'deep' — read source files, specs, team folders as well.
   */
  depth?: 'shallow' | 'standard' | 'deep';
  /** Restrict analysis to specific package or folder names. */
  scope?: string[];
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

export interface PackageInfo {
  /** Package name from package.json */
  name: string;
  /** Version string */
  version: string;
  /** Folder path relative to workspace root */
  relativePath: string;
  /** Key dependencies (name → semver range) */
  dependencies: Record<string, string>;
  /** Scripts defined in package.json */
  scripts: Record<string, string>;
  /** Short description from package.json, if present */
  description?: string;
}

export interface ArchitectureLayer {
  /** Layer name, e.g. 'domain', 'ports', 'adapters', 'mcp', 'ui-shell' */
  name: string;
  /** Package names / folders that belong to this layer */
  members: string[];
  /** One-sentence purpose of this layer */
  purpose: string;
  /** Which layers this layer is allowed to depend on */
  allowedDependencies: string[];
}

export interface DependencyEdge {
  from: string;
  to: string;
}

export type AnalysisConfidence = 'high' | 'medium' | 'low';

export interface AnalysisSectionMeta {
  confidence: AnalysisConfidence;
  limitations: string[];
}

// ---------------------------------------------------------------------------
// Analysis result shapes
// ---------------------------------------------------------------------------

export interface ProjectAnalysis {
  /** High-level narrative summary of the architecture */
  summary: string;
  /** Detected architecture style (e.g. Hexagonal, Layered, Micro-frontend) */
  pattern: string;
  /** Layers found in the project, ordered from innermost to outermost */
  layers: ArchitectureLayer[];
  /** All packages detected in the monorepo */
  packages: PackageInfo[];
  /** Explicit cross-package dependency edges */
  dependencies: DependencyEdge[];
  /** Key observations or concerns the LLM noted */
  observations: string[];
  /** Mermaid `graph TD` diagram of the package/layer architecture */
  diagram?: string;
  /** Confidence and known limitations for this section */
  meta: AnalysisSectionMeta;
  /** Raw LLM response (useful for displaying in a panel) */
  rawResponse: string;
}

export interface DeploymentStep {
  order: number;
  label: string;
  description: string;
  /** e.g. 'build' | 'test' | 'package' | 'publish' | 'deploy' */
  type: string;
}

export interface DeploymentAnalysis {
  /** High-level narrative of the deployment strategy */
  summary: string;
  /** Detected CI/CD toolchain (e.g. 'GitHub Actions', 'Turborepo + npm publish') */
  toolchain: string;
  /** Ordered deployment pipeline steps */
  pipeline: DeploymentStep[];
  /** Target environments identified (e.g. 'vscode marketplace', 'jetbrains marketplace') */
  targets: string[];
  /** Key observations or risks the LLM noted */
  observations: string[];
  /** Mermaid `flowchart LR` diagram of the deployment pipeline */
  diagram?: string;
  /** Confidence and known limitations for this section */
  meta: AnalysisSectionMeta;
  rawResponse: string;
}

export interface BusinessFlow {
  /** Short name / label of the flow (e.g. 'LLM Provider Selection') */
  name: string;
  /** Which team or package owns this flow */
  owner: string;
  /** Step-by-step description */
  steps: string[];
  /** LLM-generated narrative for this flow */
  description: string;
}

export interface BusinessFlowAnalysis {
  /** List of distinct business/user flows discovered */
  flows: BusinessFlow[];
  /** Cross-cutting concerns (auth, telemetry, error handling) */
  crossCuttingConcerns: string[];
  /** Mermaid `flowchart TD` diagram of the main business flows */
  diagram?: string;
  /** Confidence and known limitations for this section */
  meta: AnalysisSectionMeta;
  rawResponse: string;
}

// ---------------------------------------------------------------------------
// Aggregated report
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Code analysis — control flow, errors, use cases
// ---------------------------------------------------------------------------

export interface UseCase {
  name: string;
  trigger: string;
  steps: string[];
  outcomes: string[];
}

export interface CodeAnalysis {
  /** Patterns used for error handling across the codebase */
  errorHandlingPatterns: string[];
  /** Key control flow / branching patterns identified */
  controlFlowPatterns: string[];
  /** Significant conditions or guard clauses found */
  keyConditions: string[];
  /** Concrete use cases derived from the code */
  useCases: UseCase[];
  /** Mermaid `flowchart TD` diagram illustrating a key control flow */
  diagram?: string;
  /** Technical debt or improvement opportunities the LLM noted */
  technicalDebt: string[];
  /** Confidence and known limitations for this section */
  meta: AnalysisSectionMeta;
  rawResponse: string;
}

export interface GlobalToolingGap {
  title: string;
  rationale: string;
  expectedContract: string;
}

// ---------------------------------------------------------------------------
// Aggregated report
// ---------------------------------------------------------------------------

export interface ProjectReport {
  /** ISO timestamp of when the report was generated */
  generatedAt: string;
  architecture: ProjectAnalysis;
  deployment: DeploymentAnalysis;
  businessFlows: BusinessFlowAnalysis;
  codeAnalysis: CodeAnalysis;
  globalToolingGaps: GlobalToolingGap[];
  /** Executive summary combining all analyses */
  executiveSummary: string;
}
