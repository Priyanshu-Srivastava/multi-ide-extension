import type { ProjectReport } from '@omni/core';

/**
 * Typed JSON-RPC 2.0 message params for the Project Analysis panel.
 *
 * Webview → Extension:  WebviewRequest<AnalysisRequestParams>
 * Extension → Webview:  WebviewResponse<AnalysisResultParams>    (reply to request)
 *                       WebviewNotification<AnalysisProgressParams>  (progress push)
 *
 * All message envelopes use the types from @omni/core rpc — only the
 * param/result payloads are defined here, keeping this file pure data.
 */

// ---------------------------------------------------------------------------
// Requests (webview → extension)
// ---------------------------------------------------------------------------

export type AnalysisDepth = 'shallow' | 'standard' | 'deep';

export interface RunAnalysisParams {
  depth: AnalysisDepth;
  /** Optional scope narrowing. Empty/omitted means full active workspace. */
  scope?: string[];
}

// ---------------------------------------------------------------------------
// Responses (extension → webview, matching the request id)
// ---------------------------------------------------------------------------

export interface AnalysisResultParams {
  report: ProjectReport;
}

// ---------------------------------------------------------------------------
// Notifications (extension → webview, no id — one-way push)
// ---------------------------------------------------------------------------

export const ANALYSIS_STAGES = [
  'gathering',
  'architecture',
  'deployment',
  'flows',
  'code',
  'summary',
] as const;

export type AnalysisStage = typeof ANALYSIS_STAGES[number];

export interface AnalysisProgressParams {
  stage: AnalysisStage;
  message: string;
  /** 0–100 */
  percent: number;
}

// ---------------------------------------------------------------------------
// RPC method name constants — single source of truth, shared by both sides
// ---------------------------------------------------------------------------

export const AnalysisMethod = {
  /** Webview → Extension: start analysis */
  Run: 'analysis.run',
  /** Extension → Webview: one-way progress update */
  Progress: 'analysis.progress',
} as const;
