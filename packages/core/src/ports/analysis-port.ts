import type {
  AnalysisOptions,
  ProjectAnalysis,
  DeploymentAnalysis,
  BusinessFlowAnalysis,
  ProjectReport,
} from '../domain/analysis';
import type { CodeAnalysis } from '../domain/analysis';

/**
 * Minimal workspace reader contract required by project analysis features.
 * Implemented by adapter-side infrastructure (for example, WorkspaceReader).
 */
export interface WorkspaceContextReaderPort {
  toRelative(absolutePath: string): string;
  readRelative(relativePath: string): Promise<string | null>;
  findFiles(include: string, exclude?: string, maxResults?: number): Promise<string[]>;
  readMany(absolutePaths: string[]): Promise<Array<{ relativePath: string; content: string }>>;
}

/**
 * Port for project-level analysis.
 *
 * Team feature code depends ONLY on this interface — never on the concrete
 * service that lives in the VS Code adapter.  This keeps team code
 * IDE-agnostic and trivially testable (just mock the port).
 *
 * The VS Code implementation (`ProjectAnalysisService`) wires the MCP tool
 * registry and the active LLM adapter together behind this surface.
 */
export interface ProjectAnalysisPort {
  /**
   * Analyse the monorepo architecture: detect patterns, layers, packages,
   * and cross-package dependencies.
   */
  analyzeArchitecture(options?: AnalysisOptions): Promise<ProjectAnalysis>;

  /**
   * Describe the deployment strategy: CI/CD pipeline, toolchain, artefacts,
   * and publishing targets.
   */
  describeDeployment(options?: AnalysisOptions): Promise<DeploymentAnalysis>;

  /**
   * Explain the key business / user flows and cross-cutting concerns found
   * in the codebase.
   */
  explainBusinessFlows(options?: AnalysisOptions): Promise<BusinessFlowAnalysis>;

  /**
   * Run all three analyses and produce a consolidated project report.
   * Implementations may run the sub-analyses in parallel.
   */
  generateProjectReport(options?: AnalysisOptions): Promise<ProjectReport>;

  /**
   * Analyse source code for control flow, error handling, conditions, and
   * concrete use cases derived from the implementation.
   */
  analyzeCode(options?: AnalysisOptions): Promise<CodeAnalysis>;
}
