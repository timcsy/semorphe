# 技術研究：VSCode Extension 原型

**分支**: `018-vscode-extension-prototype` | **日期**: 2026-03-10

## R1: src/core/ 模組在 Node.js 環境的相容性

**決策**: src/core/ 除 `storage.ts` 外全部可在 Node.js 直接運行

**依據**:
- `semantic-bus.ts`：純 TypeScript Map/Set EventEmitter，零 DOM 依賴
- `semantic-tree.ts`：純函數式樹操作
- `lift/`、`projection/`、`registry/`：純邏輯，無瀏覽器 API
- `storage.ts`：使用 `localStorage`、`Blob`、`document.createElement` — VSCode extension 不需要此模組（用 VSCode workspace state 取代）

**被排除的替代方案**:
- 重新實作核心邏輯 → 違反 FR-006（不得重新實作）
- 在 Node.js 中 polyfill DOM → 不必要，核心本身不需 DOM

## R2: tree-sitter WASM 在 Extension Host 載入

**決策**: web-tree-sitter WASM 可在 Node.js 運行，需明確指定 WASM 路徑

**依據**:
- `src/languages/cpp/parser.ts` 已有 `init(wasmDir?)` 參數支援自訂路徑
- `getDefaultWasmDir()` 已檢測 `process.cwd()`，在 Node.js 環境可用
- Extension 需將 `tree-sitter.wasm` 和 `tree-sitter-cpp.wasm` 複製到 `dist/` 並傳入絕對路徑

**被排除的替代方案**:
- 使用原生 tree-sitter binding → 造成平台特定打包問題，不適合 VSCode extension

## R3: Blockly 在 VSCode WebView 中的 CSP 設定

**決策**: Blockly 可在 WebView 中運行，需 `style-src 'unsafe-inline'`

**依據**:
- Blockly 大量使用 inline style 屬性於 SVG 定位（無法避免）
- 多個已存在的 VSCode extension 驗證了此方案（vscode-blockly、Singular Blockly 等）
- 最小 CSP：`default-src 'none'; script-src 'nonce-${nonce}'; style-src ${cspSource} 'unsafe-inline'; img-src ${cspSource}; font-src ${cspSource};`

**被排除的替代方案**:
- 用 CSP hash 替代 unsafe-inline → Blockly 動態生成的 style 數量不可列舉

## R4: Extension Host ↔ WebView 通訊模式

**決策**: 使用原生 `postMessage` 搭配命令式訊息格式

**依據**:
- Extension → WebView：`panel.webview.postMessage({ command, data })`
- WebView → Extension：`vscode.postMessage({ command, data })` + `acquireVsCodeApi()`
- Extension 監聽：`panel.webview.onDidReceiveMessage(handler)`
- WebView 監聽：`window.addEventListener('message', handler)`
- 與現有 SemanticBus 的 `SemanticEvents` / `ViewRequests` 型別直接映射

**被排除的替代方案**:
- vscode-messenger 函式庫 → 增加依賴，原生 postMessage 足夠簡單

## R5: 打包策略

**決策**: esbuild 雙配置 — Node.js（Extension Host）+ Browser（WebView）

**依據**:
- Extension Host 入口：`platform: 'node'`、`format: 'cjs'`、`external: ['vscode']`
- WebView 入口：`platform: 'browser'`、`format: 'iife'`
- Blockly 打包進 WebView bundle（IIFE）
- WASM 檔案作為靜態資源複製到 `dist/`
- Blockly media（SVG）複製到 `dist/media/`，透過 `asWebviewUri` 載入

**被排除的替代方案**:
- webpack → esbuild 更快、設定更簡單，是 2026 年 VSCode extension 的標準選擇
- Vite → 主要用於瀏覽器應用，不適合 Extension Host 的 CJS 輸出

## R6: TextDocument API 與同步迴圈防護

**決策**: `onDidChangeTextDocument` 監聽 + `WorkspaceEdit.applyEdit()` 回寫，搭配 flag 防止無限迴圈

**依據**:
- 程式碼變更 → lift → semantic:update → 積木更新
- 積木變更 → generate → `WorkspaceEdit` 回寫程式碼
- `applyEdit` 會觸發 `onDidChangeTextDocument`，需設 `_isApplyingEdit` flag 跳過

**被排除的替代方案**:
- 使用 `TextEditor.edit()` → `WorkspaceEdit` 可操作非活動文件，更靈活

## R7: UI 模組在 WebView 中的重用

**決策**: `block-registrar.ts` 和 `toolbox-builder.ts` 在 WebView 中使用

**依據**:
- `block-registrar.ts`：依賴 Blockly，必須在 WebView（瀏覽器）中運行 ✅
- `toolbox-builder.ts`：純資料結構，無 Blockly 依賴，可在兩邊運行，但放在 WebView 更自然（與 Blockly 一起）
- WebView 需要的模組：`block-registrar.ts`、`toolbox-builder.ts`、`cognitive-levels.ts`、`block-spec-registry.ts`、JSON 概念/投影資料

**被排除的替代方案**:
- 在 Extension Host 建構 toolbox 再傳到 WebView → 增加序列化成本，且 toolbox 結構緊耦合 Blockly
