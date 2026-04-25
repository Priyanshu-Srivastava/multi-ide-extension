import * as vscode from 'vscode';
import type { LLMPort } from '@omni/core';
import type { WebviewRequest, WebviewResponse, WebviewNotification } from '@omni/core';
import type { WorkspaceContextReaderPort } from '@omni/core';
import { ProjectAnalysisService } from './project-analysis-service';
import {
  AnalysisMethod,
  type RunAnalysisParams,
  type AnalysisResultParams,
  type AnalysisProgressParams,
  type AnalysisDepth,
} from './ipc-contract';
import type { ProjectReport } from '@omni/core';

let panel: vscode.WebviewPanel | undefined;

export function openAnalysisPanel(
  context: vscode.ExtensionContext,
  reader: WorkspaceContextReaderPort,
  llm: LLMPort,
): void {
  if (panel) {
    panel.reveal(vscode.ViewColumn.One);
    return;
  }

  panel = vscode.window.createWebviewPanel(
    'omniProjectAnalyser',
    'Project Analyser — Team D',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      // Allow the Mermaid CDN script
      localResourceRoots: [],
    },
  );

  panel.webview.html = getHtml();

  const service = new ProjectAnalysisService(reader, llm);

  panel.webview.onDidReceiveMessage(
    async (msg: WebviewRequest<RunAnalysisParams>) => {
      if (msg.jsonrpc !== '2.0' || msg.method !== AnalysisMethod.Run || !msg.params) return;

      const reqId = msg.id;
      const depth: AnalysisDepth = msg.params.depth ?? 'standard';
      const opts = { depth, scope: msg.params.scope };

      function notify(stage: AnalysisProgressParams['stage'], message: string, percent: number): void {
        const n: WebviewNotification<AnalysisProgressParams> = {
          jsonrpc: '2.0',
          method: AnalysisMethod.Progress,
          params: { stage, message, percent },
        };
        panel?.webview.postMessage(n);
      }

      function reply(result: AnalysisResultParams): void {
        const r: WebviewResponse<AnalysisResultParams> = { jsonrpc: '2.0', id: reqId, result };
        panel?.webview.postMessage(r);
      }

      function replyError(message: string): void {
        const r: WebviewResponse = { jsonrpc: '2.0', id: reqId, error: { code: -32000, message } };
        panel?.webview.postMessage(r);
      }

      try {
        const report: ProjectReport = await service.generateProjectReportWithProgress(
          (stage, message, percent) => notify(stage, message, percent),
          opts,
        );

        reply({ report });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        replyError(message);
      }
    },
    undefined,
    context.subscriptions,
  );

  panel.onDidDispose(() => { panel = undefined; }, undefined, context.subscriptions);
}

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

function getHtml(): string {
  return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 style-src 'unsafe-inline' https://cdn.jsdelivr.net;
                 script-src 'unsafe-inline' https://cdn.jsdelivr.net;
                 img-src data: blob: https:;
                 font-src https://cdn.jsdelivr.net;">
  <title>Project Analyser</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --radius: 6px;
      --gap: 16px;
    }

    body {
      font-family: var(--vscode-font-family, system-ui);
      font-size: var(--vscode-font-size, 13px);
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      padding: 24px;
      line-height: 1.6;
    }

    /* ── Header ─────────────────────────────────────── */
    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--vscode-widget-border, rgba(255,255,255,.08));
    }
    .header h1 { font-size: 18px; font-weight: 600; letter-spacing: .3px; }
    .badge {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 3px 8px;
      border-radius: 20px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }

    /* ── Controls ───────────────────────────────────── */
    .controls {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    select, button {
      font-family: inherit;
      font-size: 12px;
      border-radius: var(--radius);
      outline: none;
      cursor: pointer;
    }

    select {
      padding: 7px 12px;
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border, var(--vscode-input-border));
    }

    .btn-primary {
      padding: 7px 20px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      font-weight: 600;
      transition: opacity .15s;
    }
    .btn-primary:hover { opacity: .85; }
    .btn-primary:disabled { opacity: .4; cursor: default; }

    label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .6px;
      opacity: .65;
    }

    /* ── Progress ───────────────────────────────────── */
    #progressSection { margin-bottom: 24px; }

    .stages {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }
    .stage {
      font-size: 11px;
      padding: 4px 10px;
      border-radius: 20px;
      background: var(--vscode-editorWidget-background, rgba(255,255,255,.05));
      opacity: .45;
      transition: opacity .3s, background .3s;
    }
    .stage.active {
      opacity: 1;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }
    .stage.done {
      opacity: .8;
      background: var(--vscode-terminal-ansiGreen, #3a9b3a);
      color: #fff;
    }

    .progress-track {
      height: 4px;
      border-radius: 2px;
      background: var(--vscode-editorWidget-background, rgba(255,255,255,.08));
      overflow: hidden;
      margin-bottom: 8px;
    }
    .progress-fill {
      height: 100%;
      background: var(--vscode-progressBar-background, #0e70c0);
      border-radius: 2px;
      transition: width .4s ease;
      width: 0%;
    }
    .progress-msg {
      font-size: 11px;
      opacity: .7;
    }

    /* ── Error ──────────────────────────────────────── */
    #errorSection {
      padding: 14px 16px;
      border-radius: var(--radius);
      background: rgba(255,80,80,.1);
      border: 1px solid rgba(255,80,80,.3);
      margin-bottom: 20px;
    }
    #errorSection p { margin-bottom: 10px; color: var(--vscode-errorForeground, #f48771); }

    /* ── Report ─────────────────────────────────────── */
    .tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 16px;
      flex-wrap: wrap;
      border-bottom: 1px solid var(--vscode-widget-border, rgba(255,255,255,.08));
      padding-bottom: 1px;
    }
    .tab-btn {
      padding: 7px 14px;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      font-size: 12px;
      opacity: .6;
      transition: opacity .15s, border-color .15s;
      margin-bottom: -1px;
    }
    .tab-btn:hover { opacity: .9; }
    .tab-btn.active {
      opacity: 1;
      border-bottom-color: var(--vscode-textLink-foreground, #3794ff);
      color: var(--vscode-textLink-foreground, #3794ff);
    }

    .tab-panel { display: none; }
    .tab-panel.visible { display: block; }

    /* ── Report content ─────────────────────────────── */
    .section-title {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 12px;
      margin-top: 24px;
    }
    .section-title:first-child { margin-top: 0; }

    .summary-box {
      padding: 14px 16px;
      border-radius: var(--radius);
      background: var(--vscode-editorWidget-background, rgba(255,255,255,.04));
      border-left: 3px solid var(--vscode-textLink-foreground, #3794ff);
      margin-bottom: 20px;
      line-height: 1.7;
    }

    .pattern-tag {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      margin-bottom: 16px;
    }

    .diagram-box {
      margin: 16px 0 24px;
      padding: 16px;
      border-radius: var(--radius);
      background: var(--vscode-editorWidget-background, rgba(255,255,255,.04));
      border: 1px solid var(--vscode-widget-border, rgba(255,255,255,.08));
      overflow-x: auto;
    }
    .diagram-box svg { max-width: 100%; }
    .diagram-fallback {
      font-size: 11px;
      font-family: var(--vscode-editor-font-family, monospace);
      white-space: pre;
      overflow-x: auto;
      opacity: .8;
    }

    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: var(--gap);
      margin-bottom: 20px;
    }
    .card {
      padding: 14px;
      border-radius: var(--radius);
      background: var(--vscode-editorWidget-background, rgba(255,255,255,.04));
      border: 1px solid var(--vscode-widget-border, rgba(255,255,255,.06));
    }
    .card-title {
      font-weight: 600;
      font-size: 12px;
      margin-bottom: 6px;
      color: var(--vscode-textLink-foreground, #3794ff);
    }
    .card-meta {
      font-size: 11px;
      opacity: .6;
      margin-bottom: 4px;
    }

    .list-clean {
      list-style: none;
      padding: 0;
    }
    .list-clean li {
      padding: 6px 0;
      border-bottom: 1px solid var(--vscode-widget-border, rgba(255,255,255,.05));
      font-size: 12px;
    }
    .list-clean li:last-child { border-bottom: none; }
    .list-clean li::before { content: '→ '; opacity: .4; }

    .pipeline {
      display: flex;
      align-items: flex-start;
      gap: 0;
      flex-wrap: wrap;
      margin-bottom: 20px;
    }
    .pipeline-step {
      display: flex;
      align-items: center;
    }
    .pipeline-node {
      padding: 8px 14px;
      border-radius: var(--radius);
      border: 1px solid var(--vscode-widget-border, rgba(255,255,255,.12));
      font-size: 11px;
      font-weight: 600;
      text-align: center;
      min-width: 80px;
    }
    .pipeline-node.build   { border-color: #3794ff; color: #3794ff; }
    .pipeline-node.test    { border-color: #89d185; color: #89d185; }
    .pipeline-node.package { border-color: #dcdcaa; color: #dcdcaa; }
    .pipeline-node.publish { border-color: #c586c0; color: #c586c0; }
    .pipeline-node.deploy  { border-color: #f48771; color: #f48771; }
    .pipeline-arrow {
      font-size: 16px;
      opacity: .4;
      margin: 0 6px;
      padding-top: 7px;
    }

    .observation {
      font-size: 12px;
      padding: 5px 10px;
      border-radius: 4px;
      background: rgba(255,200,80,.08);
      border-left: 3px solid rgba(255,200,80,.4);
      margin-bottom: 6px;
    }

    .meta-box {
      margin: 12px 0 20px;
      padding: 12px 14px;
      border-radius: var(--radius);
      background: var(--vscode-editorWidget-background, rgba(255,255,255,.04));
      border: 1px solid var(--vscode-widget-border, rgba(255,255,255,.06));
    }
    .meta-box.low {
      border-left: 3px solid var(--vscode-errorForeground, #f48771);
    }
    .meta-box.medium {
      border-left: 3px solid #d7ba7d;
    }
    .meta-box.high {
      border-left: 3px solid #89d185;
    }
    .meta-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .7px;
      margin-bottom: 6px;
      opacity: .85;
    }
    .meta-limitations {
      font-size: 12px;
      opacity: .82;
    }

    .gap-card {
      padding: 14px;
      border-radius: var(--radius);
      background: rgba(255, 165, 0, 0.08);
      border: 1px solid rgba(255, 165, 0, 0.18);
      margin-bottom: 12px;
    }
    .gap-card h4 {
      font-size: 13px;
      margin-bottom: 6px;
    }
    .gap-card p {
      font-size: 12px;
      margin-bottom: 6px;
    }

    .use-case {
      margin-bottom: 16px;
      padding: 12px 14px;
      border-radius: var(--radius);
      background: var(--vscode-editorWidget-background, rgba(255,255,255,.04));
      border: 1px solid var(--vscode-widget-border, rgba(255,255,255,.06));
    }
    .use-case-name {
      font-weight: 600;
      font-size: 12px;
      margin-bottom: 4px;
      color: var(--vscode-textLink-foreground, #3794ff);
    }
    .use-case-trigger {
      font-size: 11px;
      opacity: .6;
      margin-bottom: 8px;
    }

    .flow-card {
      margin-bottom: 16px;
      padding: 12px 14px;
      border-radius: var(--radius);
      background: var(--vscode-editorWidget-background, rgba(255,255,255,.04));
      border: 1px solid var(--vscode-widget-border, rgba(255,255,255,.06));
    }
    .flow-name {
      font-weight: 600;
      font-size: 13px;
      margin-bottom: 4px;
    }
    .flow-owner {
      font-size: 11px;
      opacity: .6;
      margin-bottom: 8px;
    }
    .flow-desc { font-size: 12px; margin-bottom: 8px; }

    .timestamp {
      font-size: 10px;
      opacity: .45;
      margin-top: 32px;
      text-align: right;
    }

    [hidden] { display: none !important; }
  </style>
</head>
<body>

<!-- Header -->
<div class="header">
  <h1>🔍 Project Analyser</h1>
  <span class="badge">Team D</span>
</div>

<!-- Controls -->
<div id="controls" class="controls">
  <div>
    <label for="depth">Analysis Depth</label><br>
    <select id="depth" style="margin-top:4px">
      <option value="shallow">Shallow — Overview only</option>
      <option value="standard" selected>Standard — Full analysis</option>
      <option value="deep">Deep — Include source files</option>
    </select>
  </div>
  <button class="btn-primary" id="runBtn" style="margin-top:20px">▶ Run Analysis</button>
</div>

<!-- Progress -->
<div id="progressSection" hidden>
  <div class="stages">
    <span class="stage" id="stage-gathering">📁 Gathering</span>
    <span class="stage" id="stage-architecture">🏗 Architecture</span>
    <span class="stage" id="stage-deployment">🚀 Deployment</span>
    <span class="stage" id="stage-flows">🔄 Flows</span>
    <span class="stage" id="stage-code">🔍 Code</span>
    <span class="stage" id="stage-summary">📋 Summary</span>
  </div>
  <div class="progress-track"><div class="progress-fill" id="progressFill"></div></div>
  <p class="progress-msg" id="progressMsg">Initialising…</p>
</div>

<!-- Error -->
<div id="errorSection" hidden>
  <p id="errorMsg"></p>
  <button class="btn-primary" id="retryBtn">↩ Retry</button>
</div>

<!-- Report -->
<div id="reportSection" hidden>
  <div class="tabs">
    <button class="tab-btn active" data-tab="overview">📋 Overview</button>
    <button class="tab-btn" data-tab="architecture">🏗 Architecture</button>
    <button class="tab-btn" data-tab="flows">🔄 Business Flows</button>
    <button class="tab-btn" data-tab="deployment">🚀 Deployment</button>
    <button class="tab-btn" data-tab="code">🔍 Code Analysis</button>
  </div>

  <div id="tab-overview"      class="tab-panel visible"></div>
  <div id="tab-architecture"  class="tab-panel"></div>
  <div id="tab-flows"         class="tab-panel"></div>
  <div id="tab-deployment"    class="tab-panel"></div>
  <div id="tab-code"          class="tab-panel"></div>
</div>

<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<script>
'use strict';

/* ── Mermaid init ──────────────────────────────────────────────────── */
mermaid.initialize({
  startOnLoad: false,
  theme: document.body.style.getPropertyValue('--vscode-editor-background') ? 'dark' : 'default',
  securityLevel: 'loose',
  fontFamily: 'var(--vscode-font-family, system-ui)',
});

async function renderMermaid(code, container) {
  if (!code) { container.innerHTML = '<em style="opacity:.5">No diagram generated.</em>'; return; }
  try {
    const id = 'md-' + Math.random().toString(36).slice(2);
    const { svg } = await mermaid.render(id, code);
    container.innerHTML = svg;
  } catch (err) {
    container.innerHTML = '<pre class="diagram-fallback">' + escHtml(code) + '</pre>';
  }
}

/* ── Helpers ───────────────────────────────────────────────────────── */
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function el(id) { return document.getElementById(id); }

/* ── IPC state ─────────────────────────────────────────────────────── */
const vscode = acquireVsCodeApi();
let _reqId = 0;
let _lastRunParams = null;

const STAGE_ORDER = ['gathering','architecture','deployment','flows','code','summary'];

/* ── UI state helpers ──────────────────────────────────────────────── */
function showProgress() {
  el('controls').hidden = true;
  el('progressSection').hidden = false;
  el('errorSection').hidden = true;
  el('reportSection').hidden = true;
  STAGE_ORDER.forEach(s => {
    const n = el('stage-' + s);
    if (n) { n.classList.remove('active','done'); }
  });
  el('progressFill').style.width = '0%';
  el('progressMsg').textContent = 'Initialising…';
}

function showError(msg) {
  el('controls').hidden = false;
  el('progressSection').hidden = true;
  el('errorSection').hidden = false;
  el('errorMsg').textContent = msg;
}

function updateProgress(params) {
  el('progressFill').style.width = params.percent + '%';
  el('progressMsg').textContent = params.message;
  const idx = STAGE_ORDER.indexOf(params.stage);
  STAGE_ORDER.forEach((s, i) => {
    const n = el('stage-' + s);
    if (!n) return;
    n.classList.remove('active','done');
    if (i < idx)      n.classList.add('done');
    else if (i === idx) n.classList.add('active');
  });
}

/* ── Tab navigation ────────────────────────────────────────────────── */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('visible'));
    this.classList.add('active');
    el('tab-' + this.dataset.tab).classList.add('visible');
  });
});

/* ── Run analysis ──────────────────────────────────────────────────── */
function sendAnalysisRequest(params) {
  _lastRunParams = params;
  showProgress();
  vscode.postMessage({ jsonrpc: '2.0', id: ++_reqId, method: 'analysis.run', params });
}

el('runBtn').addEventListener('click', () => {
  const depth = el('depth').value;
  sendAnalysisRequest({ depth });
});

el('retryBtn').addEventListener('click', () => {
  if (_lastRunParams) {
    sendAnalysisRequest(_lastRunParams);
    return;
  }
  el('errorSection').hidden = true;
  el('controls').hidden = false;
});

/* ── Message handler ───────────────────────────────────────────────── */
window.addEventListener('message', async e => {
  const msg = e.data;
  if (!msg || msg.jsonrpc !== '2.0') return;

  // Notification (no id) — progress update
  if (msg.method === 'analysis.progress' && msg.params) {
    updateProgress(msg.params);
    return;
  }

  // Response (has id)
  if (msg.id !== undefined) {
    if (msg.error) {
      showError(msg.error.message || 'An unexpected error occurred.');
      return;
    }
    if (msg.result && msg.result.report) {
      await renderReport(msg.result.report);
    }
  }
});

/* ── Report rendering ──────────────────────────────────────────────── */
async function renderReport(report) {
  updateProgress({ stage: 'summary', message: 'Rendering report…', percent: 100 });
  await Promise.all([
    renderOverview(report),
    renderArchitecture(report.architecture),
    renderFlows(report.businessFlows),
    renderDeployment(report.deployment),
    renderCode(report.codeAnalysis),
  ]);

  el('progressSection').hidden = true;
  el('controls').hidden = false;
  el('reportSection').hidden = false;

  // Switch to overview tab
  document.querySelectorAll('.tab-btn')[0].click();
}

function renderOverview(report) {
  const arch = report.architecture;
  const ts = new Date(report.generatedAt).toLocaleString();
  const gapsHtml = report.globalToolingGaps && report.globalToolingGaps.length
    ? '<div class="section-title">Global Tooling Gaps</div>' +
      report.globalToolingGaps.map(gap =>
        '<div class="gap-card">' +
        '<h4>' + escHtml(gap.title) + '</h4>' +
        '<p>' + escHtml(gap.rationale) + '</p>' +
        '<p><strong>Expected contract:</strong> ' + escHtml(gap.expectedContract) + '</p>' +
        '</div>'
      ).join('')
    : '';
  el('tab-overview').innerHTML =
    '<div class="summary-box">' + escHtml(report.executiveSummary) + '</div>' +
    statsRow(arch, report.deployment, report.businessFlows, report.codeAnalysis) +
    gapsHtml +
    '<p class="timestamp">Generated: ' + ts + '</p>';
}

function renderMeta(meta) {
  if (!meta) { return ''; }
  const level = escHtml(meta.confidence || 'medium');
  const limitations = (meta.limitations || []).length
    ? '<ul class="list-clean meta-limitations">' + meta.limitations.map(item => '<li>' + escHtml(item) + '</li>').join('') + '</ul>'
    : '<div class="meta-limitations">No explicit limitations recorded.</div>';
  return '<div class="meta-box ' + level + '">' +
    '<div class="meta-title">Confidence: ' + level + '</div>' +
    limitations +
    '</div>';
}

function statsRow(arch, deploy, flows, code) {
  const stats = [
    { label: 'Packages',    value: arch.packages ? arch.packages.length : '–' },
    { label: 'Layers',      value: arch.layers   ? arch.layers.length   : '–' },
    { label: 'Flows',       value: flows.flows   ? flows.flows.length   : '–' },
    { label: 'Use Cases',   value: code.useCases ? code.useCases.length : '–' },
    { label: 'Pipeline steps', value: deploy.pipeline ? deploy.pipeline.length : '–' },
    { label: 'Debt items',  value: code.technicalDebt ? code.technicalDebt.length : '–' },
  ];
  return '<div class="card-grid" style="margin-top:20px">' +
    stats.map(s =>
      '<div class="card" style="text-align:center">' +
      '<div style="font-size:28px;font-weight:700;margin-bottom:4px">' + s.value + '</div>' +
      '<div class="card-meta">' + s.label + '</div>' +
      '</div>'
    ).join('') +
    '</div>';
}

async function renderArchitecture(arch) {
  let html = '';
  html += '<div class="pattern-tag">' + escHtml(arch.pattern || 'Unknown') + '</div>';
  html += '<div class="summary-box">' + escHtml(arch.summary) + '</div>';
  html += renderMeta(arch.meta);

  // Diagram placeholder
  html += '<div class="section-title">Package Map</div>';
  html += '<div class="diagram-box" id="arch-diagram"></div>';

  // Layers
  if (arch.layers && arch.layers.length) {
    html += '<div class="section-title">Layers</div><div class="card-grid">';
    arch.layers.forEach(layer => {
      html +=
        '<div class="card">' +
        '<div class="card-title">' + escHtml(layer.name) + '</div>' +
        '<div style="font-size:12px;margin-bottom:6px">' + escHtml(layer.purpose) + '</div>' +
        '<div class="card-meta">Members: ' + escHtml((layer.members || []).join(', ')) + '</div>' +
        '<div class="card-meta">Depends on: ' + escHtml((layer.allowedDependencies || []).join(', ') || 'none') + '</div>' +
        '</div>';
    });
    html += '</div>';
  }

  // Packages table
  if (arch.packages && arch.packages.length) {
    html += '<div class="section-title">Packages (' + arch.packages.length + ')</div>';
    html += '<div class="card-grid">';
    arch.packages.forEach(pkg => {
      html +=
        '<div class="card">' +
        '<div class="card-title">' + escHtml(pkg.name) + '</div>' +
        '<div class="card-meta">' + escHtml(pkg.relativePath) + '</div>' +
        (pkg.description ? '<div style="font-size:11px;margin-top:4px">' + escHtml(pkg.description) + '</div>' : '') +
        '</div>';
    });
    html += '</div>';
  }

  // Observations
  if (arch.observations && arch.observations.length) {
    html += '<div class="section-title">Observations</div>';
    arch.observations.forEach(o => { html += '<div class="observation">' + escHtml(o) + '</div>'; });
  }

  el('tab-architecture').innerHTML = html;
  await renderMermaid(arch.diagram, el('arch-diagram'));
}

async function renderFlows(flows) {
  let html = '<div class="section-title">Flow Diagram</div>';
  html += '<div class="diagram-box" id="flows-diagram"></div>';
  html += renderMeta(flows.meta);

  if (flows.flows && flows.flows.length) {
    html += '<div class="section-title">Flows (' + flows.flows.length + ')</div>';
    flows.flows.forEach(flow => {
      html +=
        '<div class="flow-card">' +
        '<div class="flow-name">' + escHtml(flow.name) + '</div>' +
        '<div class="flow-owner">Owner: ' + escHtml(flow.owner) + '</div>' +
        '<div class="flow-desc">' + escHtml(flow.description) + '</div>' +
        '<ul class="list-clean">' +
        (flow.steps || []).map(s => '<li>' + escHtml(s) + '</li>').join('') +
        '</ul></div>';
    });
  }

  if (flows.crossCuttingConcerns && flows.crossCuttingConcerns.length) {
    html += '<div class="section-title">Cross-Cutting Concerns</div>';
    html += '<ul class="list-clean">' +
      flows.crossCuttingConcerns.map(c => '<li>' + escHtml(c) + '</li>').join('') +
      '</ul>';
  }

  el('tab-flows').innerHTML = html;
  await renderMermaid(flows.diagram, el('flows-diagram'));
}

async function renderDeployment(deploy) {
  let html = '<div class="summary-box">' + escHtml(deploy.summary) + '</div>';
  html += '<div class="pattern-tag">🔧 ' + escHtml(deploy.toolchain || 'Unknown') + '</div>';
  html += renderMeta(deploy.meta);

  html += '<div class="section-title">Pipeline Diagram</div>';
  html += '<div class="diagram-box" id="deploy-diagram"></div>';

  if (deploy.pipeline && deploy.pipeline.length) {
    html += '<div class="section-title">Pipeline Steps</div>';
    html += '<div class="pipeline">';
    deploy.pipeline.forEach((step, i) => {
      html += '<div class="pipeline-step">';
      html += '<div class="pipeline-node ' + escHtml(step.type) + '">' +
        '<div style="font-size:10px;opacity:.6">' + step.order + '</div>' +
        escHtml(step.label) +
        '</div>';
      if (i < deploy.pipeline.length - 1) html += '<div class="pipeline-arrow">→</div>';
      html += '</div>';
    });
    html += '</div>';

    html += '<div class="card-grid">';
    deploy.pipeline.forEach(step => {
      html +=
        '<div class="card">' +
        '<div class="card-title">' + escHtml(step.label) + '</div>' +
        '<div class="card-meta">' + escHtml(step.type.toUpperCase()) + '</div>' +
        '<div style="font-size:12px;margin-top:4px">' + escHtml(step.description) + '</div>' +
        '</div>';
    });
    html += '</div>';
  }

  if (deploy.targets && deploy.targets.length) {
    html += '<div class="section-title">Targets</div>';
    html += '<ul class="list-clean">' +
      deploy.targets.map(t => '<li>' + escHtml(t) + '</li>').join('') +
      '</ul>';
  }

  if (deploy.observations && deploy.observations.length) {
    html += '<div class="section-title">Observations</div>';
    deploy.observations.forEach(o => { html += '<div class="observation">' + escHtml(o) + '</div>'; });
  }

  el('tab-deployment').innerHTML = html;
  await renderMermaid(deploy.diagram, el('deploy-diagram'));
}

async function renderCode(code) {
  let html = '';

  html += '<div class="section-title">Control Flow Diagram</div>';
  html += '<div class="diagram-box" id="code-diagram"></div>';
  html += renderMeta(code.meta);

  if (code.useCases && code.useCases.length) {
    html += '<div class="section-title">Use Cases (' + code.useCases.length + ')</div>';
    code.useCases.forEach(uc => {
      html +=
        '<div class="use-case">' +
        '<div class="use-case-name">' + escHtml(uc.name) + '</div>' +
        '<div class="use-case-trigger">Trigger: ' + escHtml(uc.trigger) + '</div>' +
        '<ul class="list-clean">' +
        (uc.steps || []).map(s => '<li>' + escHtml(s) + '</li>').join('') +
        '</ul>' +
        (uc.outcomes && uc.outcomes.length
          ? '<div style="margin-top:8px;font-size:11px;opacity:.7">Outcomes: ' +
            uc.outcomes.map(o => escHtml(o)).join(' · ') + '</div>'
          : '') +
        '</div>';
    });
  }

  if (code.errorHandlingPatterns && code.errorHandlingPatterns.length) {
    html += '<div class="section-title">Error Handling Patterns</div>';
    html += '<ul class="list-clean">' +
      code.errorHandlingPatterns.map(p => '<li>' + escHtml(p) + '</li>').join('') +
      '</ul>';
  }

  if (code.controlFlowPatterns && code.controlFlowPatterns.length) {
    html += '<div class="section-title">Control Flow Patterns</div>';
    html += '<ul class="list-clean">' +
      code.controlFlowPatterns.map(p => '<li>' + escHtml(p) + '</li>').join('') +
      '</ul>';
  }

  if (code.keyConditions && code.keyConditions.length) {
    html += '<div class="section-title">Key Conditions</div>';
    html += '<ul class="list-clean">' +
      code.keyConditions.map(c => '<li>' + escHtml(c) + '</li>').join('') +
      '</ul>';
  }

  if (code.technicalDebt && code.technicalDebt.length) {
    html += '<div class="section-title">⚠ Technical Debt</div>';
    code.technicalDebt.forEach(d => { html += '<div class="observation">' + escHtml(d) + '</div>'; });
  }

  el('tab-code').innerHTML = html;
  await renderMermaid(code.diagram, el('code-diagram'));
}
</script>
</body>
</html>`;
}
