import * as vscode from 'vscode';

let mathPanel: vscode.WebviewPanel | undefined;

export function openMathPanel(context: vscode.ExtensionContext, teamId: string): void {
  if (mathPanel) {
    mathPanel.reveal(vscode.ViewColumn.One);
    return;
  }

  mathPanel = vscode.window.createWebviewPanel(
    'omniMath',
    `Omni Math — ${teamId}`,
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true }
  );

  mathPanel.webview.html = getMathHtml(teamId);

  mathPanel.webview.onDidReceiveMessage(
    (msg: { command: string; a: number; b: number; op: string }) => {
      if (msg.command !== 'calculate') { return; }
      const { a, b, op } = msg;
      let result: number | string;
      switch (op) {
        case '+': result = a + b;                                        break;
        case '-': result = a - b;                                        break;
        case '*': result = a * b;                                        break;
        case '/': result = b === 0 ? 'Error: Division by zero' : a / b; break;
        case '%': result = b === 0 ? 'Error: Division by zero' : a % b; break;
        case '^': result = Math.pow(a, b);                               break;
        default:  result = 'Unknown operation';
      }
      mathPanel!.webview.postMessage({ command: 'result', value: result });
    },
    undefined,
    context.subscriptions
  );

  mathPanel.onDidDispose(() => { mathPanel = undefined; }, undefined, context.subscriptions);
}

// ---------------------------------------------------------------------------

function getMathHtml(teamId: string): string {
  return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
  <title>Omni Math</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family, system-ui);
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      min-height: 100vh;
      display: flex; align-items: flex-start; justify-content: center;
      padding: 48px 20px;
    }
    .card { width: 100%; max-width: 400px; }
    h2 { font-size: 17px; font-weight: 600; color: var(--vscode-textLink-foreground); margin-bottom: 28px; }
    .field { margin-bottom: 16px; }
    label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .6px; opacity: .65; margin-bottom: 5px; }
    input[type="number"] {
      width: 100%; padding: 8px 12px;
      background: var(--vscode-input-background); color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, #555); border-radius: 3px; font-size: 15px; outline: none;
    }
    input[type="number"]:focus { border-color: var(--vscode-focusBorder); }
    .ops { display: grid; grid-template-columns: repeat(6,1fr); gap: 7px; margin: 20px 0; }
    .ops button {
      padding: 12px 0; background: var(--vscode-button-secondaryBackground, #3a3d41);
      color: var(--vscode-button-secondaryForeground, #ccc); border: 1px solid transparent;
      border-radius: 3px; font-size: 16px; cursor: pointer;
    }
    .ops button:hover { background: var(--vscode-button-secondaryHoverBackground, #45494e); }
    .ops button.active { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .result-label { font-size: 11px; text-transform: uppercase; letter-spacing: .6px; opacity: .65; margin-bottom: 8px; }
    .result {
      padding: 14px 18px; background: var(--vscode-textCodeBlock-background, rgba(255,255,255,.04));
      border-radius: 3px; border: 1px solid var(--vscode-widget-border, rgba(255,255,255,.07));
      font-size: 26px; min-height: 58px; display: flex; align-items: center;
    }
    .placeholder { opacity: .35; font-size: 16px; }
    .error { color: var(--vscode-errorForeground, #f48771); font-size: 15px; }
    .history { margin-top: 28px; }
    .history h3 { font-size: 11px; text-transform: uppercase; letter-spacing: .6px; opacity: .65; margin-bottom: 10px; }
    .history-list { list-style: none; font-size: 13px; }
    .history-list li { padding: 5px 0; opacity:.75; border-bottom: 1px solid var(--vscode-widget-border, rgba(255,255,255,.06)); }
    .history-list li:last-child { border-bottom: none; }
  </style>
</head>
<body>
<div class="card">
  <h2>⟨ Omni Math · ${teamId} ⟩</h2>
  <div class="field"><label for="numA">Number A</label><input id="numA" type="number" value="0" /></div>
  <div class="field"><label for="numB">Number B</label><input id="numB" type="number" value="0" /></div>
  <div class="ops">
    <button data-op="+" title="Add">＋</button>
    <button data-op="-" title="Subtract">−</button>
    <button data-op="*" title="Multiply">×</button>
    <button data-op="/" title="Divide">÷</button>
    <button data-op="%" title="Modulo">mod</button>
    <button data-op="^" title="Power">xⁿ</button>
  </div>
  <div class="result-label">Result</div>
  <div class="result" id="result"><span class="placeholder">select an operation above</span></div>
  <div class="history" id="historySection" style="display:none">
    <h3>History</h3>
    <ul class="history-list" id="historyList"></ul>
  </div>
</div>
<script>
  const vscode = acquireVsCodeApi();
  const opLabel = { '+':'＋', '-':'−', '*':'×', '/':'÷', '%':'mod', '^':'^' };
  let lastOp = null;
  const history = [];
  document.querySelectorAll('.ops button').forEach(btn => {
    btn.addEventListener('click', function () {
      const a = parseFloat(document.getElementById('numA').value) || 0;
      const b = parseFloat(document.getElementById('numB').value) || 0;
      lastOp = this.dataset.op;
      document.querySelectorAll('.ops button').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      vscode.postMessage({ command: 'calculate', a, b, op: lastOp });
    });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && lastOp) {
      vscode.postMessage({ command: 'calculate', a: parseFloat(document.getElementById('numA').value)||0, b: parseFloat(document.getElementById('numB').value)||0, op: lastOp });
    }
  });
  window.addEventListener('message', e => {
    const { command, value } = e.data;
    if (command !== 'result') return;
    const el = document.getElementById('result');
    el.innerHTML = typeof value === 'string' && value.startsWith('Error')
      ? '<span class="error">' + value + '</span>'
      : String(value);
    const a = parseFloat(document.getElementById('numA').value)||0;
    const b = parseFloat(document.getElementById('numB').value)||0;
    history.unshift(a+' '+(opLabel[lastOp]||lastOp)+' '+b+' = '+value);
    if (history.length > 10) history.pop();
    document.getElementById('historySection').style.display = 'block';
    document.getElementById('historyList').innerHTML = history.map(h=>'<li>'+h+'</li>').join('');
  });
</script>
</body>
</html>`;
}
