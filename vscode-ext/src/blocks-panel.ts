import * as vscode from 'vscode'

let currentPanel: vscode.WebviewPanel | undefined

export function createOrShow(extensionUri: vscode.Uri): vscode.WebviewPanel {
  const column = vscode.ViewColumn.Beside

  if (currentPanel) {
    currentPanel.reveal(column)
    return currentPanel
  }

  const panel = vscode.window.createWebviewPanel(
    'codeBlocklyBlocks',
    'Code Blockly: Blocks',
    column,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(extensionUri, 'dist'),
      ],
    }
  )

  panel.webview.html = getWebviewContent(panel.webview, extensionUri)
  currentPanel = panel

  panel.onDidDispose(() => {
    currentPanel = undefined
  })

  return panel
}

export function getPanel(): vscode.WebviewPanel | undefined {
  return currentPanel
}

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'main.js')
  )
  const mediaUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'media')
  )
  const nonce = getNonce()

  // CSP: Blockly requires style-src 'unsafe-inline' for inline SVG styles
  const cspSource = webview.cspSource

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${cspSource} 'unsafe-inline'; img-src ${cspSource} data:; font-src ${cspSource}; connect-src ${cspSource}; media-src ${cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code Blockly</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: var(--vscode-editor-background, #1e1e1e);
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
    }
    #main-layout {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
    }
    #blockly-wrapper {
      flex: 1;
      min-height: 0;
      position: relative;
      overflow: hidden;
    }
    #blockly-container {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }
    #empty-overlay {
      display: none;
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      justify-content: center;
      align-items: center;
      background: var(--vscode-editor-background, #1e1e1e);
      color: var(--vscode-editor-foreground, #ccc);
      font-size: 16px;
      z-index: 100;
    }
    /* ─── Quick Access Bar (replicating browser version) ─── */
    .quick-access-bar {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      background: var(--vscode-editorGroupHeader-tabsBackground, #2d2d2d);
      border-bottom: 1px solid var(--vscode-editorGroup-border, #3c3c3c);
      flex-shrink: 0;
      flex-wrap: wrap;
    }
    .quick-access-bar button {
      padding: 2px 8px;
      border: none;
      border-radius: 3px;
      background: transparent;
      color: var(--vscode-foreground, #bbb);
      cursor: pointer;
      font-size: 11px;
      line-height: 18px;
    }
    .quick-access-bar button:hover {
      background: var(--vscode-toolbar-hoverBackground, #505050);
      color: var(--vscode-foreground, #fff);
    }
    .quick-access-bar button:active {
      background: var(--vscode-toolbar-activeBackground, #404040);
    }
    .toolbar-separator {
      width: 1px;
      height: 16px;
      background: var(--vscode-editorGroup-border, #505050);
      margin: 0 4px;
    }
    /* Level selector */
    .level-selector {
      display: inline-flex;
      gap: 1px;
      background: var(--vscode-input-background, #3c3c3c);
      border-radius: 4px;
      overflow: hidden;
    }
    .level-btn {
      padding: 2px 8px !important;
      border: none !important;
      border-radius: 0 !important;
      background: var(--vscode-input-background, #3c3c3c) !important;
      color: #999 !important;
      cursor: pointer;
      font-size: 11px !important;
      font-weight: 500;
      line-height: 18px !important;
      transition: background 0.15s, color 0.15s;
    }
    .level-btn:hover {
      background: var(--vscode-toolbar-hoverBackground, #505050) !important;
      color: #ccc !important;
    }
    .level-btn.active {
      background: var(--vscode-focusBorder, #007acc) !important;
      color: #fff !important;
    }
    /* Style select */
    .toolbar-select {
      padding: 2px 6px;
      border: 1px solid var(--vscode-input-border, #555);
      border-radius: 4px;
      background: var(--vscode-input-background, #3c3c3c);
      color: var(--vscode-input-foreground, #ccc);
      font-size: 11px;
      cursor: pointer;
      outline: none;
    }
    .toolbar-select:hover, .toolbar-select:focus {
      border-color: var(--vscode-focusBorder, #007acc);
    }
    /* Auto sync button */
    #auto-sync-btn {
      font-weight: bold;
      border: 1px solid var(--vscode-input-border, #555);
      border-radius: 4px;
      padding: 4px 8px;
      transition: background 0.2s, border-color 0.2s, color 0.2s;
    }
    #auto-sync-btn.auto-sync-on {
      color: #4ec9b0;
      border-color: #4ec9b0;
      background: rgba(78, 201, 176, 0.12);
    }
    #auto-sync-btn.auto-sync-off {
      color: #888;
      border-color: var(--vscode-input-border, #555);
      background: transparent;
    }
    /* Sync direction buttons */
    #sync-blocks-btn { color: #f0c040; }
    #sync-code-btn { color: #5edc8e; }
    #sync-blocks-btn:hover { background: rgba(240, 192, 64, 0.15); }
    #sync-code-btn:hover { background: rgba(46, 204, 113, 0.15); }
    /* Status bar */
    #status-bar {
      display: flex;
      align-items: center;
      padding: 0 12px;
      height: 22px;
      background: var(--vscode-statusBar-background, #1e1e1e);
      color: var(--vscode-statusBar-foreground, #888);
      font-size: 11px;
      border-top: 1px solid var(--vscode-editorGroup-border, #3c3c3c);
      flex-shrink: 0;
    }
  </style>
</head>
<body>
  <div id="main-layout">
    <div class="quick-access-bar">
      <button id="auto-sync-btn" class="auto-sync-on" title="自動同步：開啟">⇄ 自動</button>
      <button id="sync-blocks-btn" title="積木 → 程式碼">積木→程式碼</button>
      <button id="sync-code-btn" title="程式碼 → 積木">程式碼→積木</button>
      <span class="toolbar-separator"></span>
      <span id="level-selector-mount"></span>
      <span class="toolbar-separator"></span>
      <span id="style-selector-mount"></span>
      <span class="toolbar-separator"></span>
      <span id="block-style-selector-mount"></span>
      <span class="toolbar-separator"></span>
      <button id="undo-btn" title="復原">↩</button>
      <button id="redo-btn" title="重做">↪</button>
      <button id="clear-btn" title="清空">清空</button>
    </div>
    <div id="blockly-wrapper"><div id="blockly-container"></div></div>
    <div id="status-bar"><span>C++ | 載入中...</span></div>
  </div>
  <div id="empty-overlay">請開啟 C++ 檔案</div>
  <script nonce="${nonce}">
    window.__blocklyMediaPath = '${mediaUri}/';
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`
}

function getNonce(): string {
  let text = ''
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}
