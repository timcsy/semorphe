# 實作計畫：VSCode Extension 原型

**分支**: `018-vscode-extension-prototype` | **日期**: 2026-03-10 | **規格**: [spec.md](./spec.md)

## 摘要

在同一程式碼庫中新增 VSCode extension，讓使用者在 VSCode 中打開 C++ 檔案時可開啟積木面板，實現雙向程式碼/積木同步。Extension Host（Node.js）運行現有語義核心（lifter、generator、renderer），WebView 運行 Blockly，兩者透過 postMessage 橋接。瀏覽器版不受影響。

## 技術上下文

**語言/版本**: TypeScript 5.x
**主要依賴**: VSCode Extension API ^1.85、Blockly 12.4.1、web-tree-sitter 0.26.6、esbuild
**儲存**: VSCode `workspaceState`（面板狀態）、記憶體（語義樹）
**測試**: Vitest（現有）+ VSCode Extension Test（e2e）
**目標平台**: VSCode Desktop（Node.js Extension Host + WebView）
**專案類型**: VSCode Extension（附加於現有瀏覽器應用）
**效能目標**: 積木面板渲染 < 5 秒、同步延遲 < 2 秒
**約束**: 不修改 src/ 下的現有檔案、瀏覽器版建置不受影響
**規模**: 單一語言（C++）、單一使用者

## 憲法檢查

| 原則 | 狀態 | 說明 |
|------|------|------|
| I. 簡約優先 | ✅ 通過 | 只建 MVP：Extension Host + WebView + postMessage。不做 marketplace、不做多語言、不做增量同步 |
| II. 測試驅動 | ✅ 通過 | WebView 整合測試 + 現有 Vitest 套件不退化 |
| III. Git 紀律 | ✅ 通過 | 每完成一個模組即 commit |
| IV. 規格文件保護 | ✅ 通過 | 不修改 specs/ 和 .specify/ 下的既有文件 |
| V. 繁體中文優先 | ✅ 通過 | 規格/計畫/任務全繁體中文 |

## 專案結構

### 文件（本功能）

```text
specs/018-vscode-extension-prototype/
├── spec.md
├── plan.md              # 本文件
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── postmessage-protocol.md
│   └── extension-commands.md
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit.tasks 產出
```

### 原始碼

```text
vscode-ext/
├── package.json              # Extension manifest（contributes、activationEvents）
├── tsconfig.json             # Node.js + strict
├── esbuild.mjs              # 雙配置建置腳本
├── src/
│   ├── extension.ts          # activate/deactivate 入口
│   ├── semantic-core.ts      # 封裝 SemanticCore 初始化（parser、lifter、generator、renderer）
│   ├── document-session.ts   # 每文件的語義狀態管理
│   ├── blocks-panel.ts       # WebviewPanel 建立與通訊
│   ├── postmessage-bridge.ts # postMessage ↔ SemanticBus 轉譯
│   ├── text-sync.ts          # TextDocument 監聽 + WorkspaceEdit 回寫
│   └── webview/
│       ├── main.ts           # WebView 入口（Blockly 初始化 + postMessage 監聽）
│       ├── blockly-setup.ts  # BlockRegistrar + toolbox 初始化
│       └── bridge-client.ts  # WebView 側的 postMessage 封裝
├── media/
│   └── blockly/              # Blockly media 資源（SVG 等）
├── dist/                     # 建置輸出（gitignore）
│   ├── extension.js          # Extension Host bundle (CJS, Node.js)
│   ├── webview/
│   │   └── main.js           # WebView bundle (IIFE, Browser)
│   ├── tree-sitter.wasm      # 複製的 WASM 檔案
│   └── tree-sitter-cpp.wasm
└── .vscodeignore             # VSIX 打包排除規則
```

**結構決策**: Extension 作為獨立的 `vscode-ext/` 子目錄，不修改現有 `src/`。透過 TypeScript path mapping 或相對路徑 import `src/core/` 和 `src/languages/` 模組。

## 架構設計

### 雙環境分離

```
┌─────────────────────────────────────────────┐
│  Extension Host (Node.js)                   │
│                                             │
│  extension.ts → activate()                  │
│    ├─ SemanticCore                          │
│    │   ├─ CppParser (web-tree-sitter WASM)  │
│    │   ├─ PatternLifter                     │
│    │   ├─ PatternRenderer                   │
│    │   ├─ PatternExtractor                  │
│    │   ├─ TemplateGenerator                 │
│    │   └─ CodeGenerator                     │
│    ├─ DocumentSession (per file)            │
│    ├─ TextSync (onDidChangeTextDocument)    │
│    └─ PostMessageBridge ─── postMessage ──┐ │
│                                           │ │
├───────────────────────────────────────────┤ │
│  WebView (Browser)                        │ │
│                                           │ │
│  main.ts                                ←─┘ │
│    ├─ Blockly workspace                     │
│    ├─ BlockRegistrar                        │
│    ├─ ToolboxBuilder                        │
│    └─ BridgeClient (postMessage)            │
└─────────────────────────────────────────────┘
```

### 同步流程

**程式碼 → 積木**:
1. `onDidChangeTextDocument` 觸發（debounce 300ms）
2. `CppParser.parse(code)` → AST
3. `PatternLifter.lift(ast)` → SemanticNode tree
4. `PatternRenderer.render(tree)` → Blockly state（可選，若需要）
5. `postMessage({ command: 'semantic:update', data: { tree, source: 'code' } })`
6. WebView 接收 → `PatternRenderer.render(tree)` → 更新 Blockly workspace

**積木 → 程式碼**:
1. Blockly workspace change 事件觸發
2. `PatternExtractor.extract(workspace)` → SemanticNode tree
3. `postMessage({ command: 'edit:blocks', data: { semanticTree, blocklyState } })`
4. Extension Host 接收 → `CodeGenerator.generate(tree)` → code string
5. `WorkspaceEdit.replace(document.uri, fullRange, code)` + `applyEdit()`
6. `_isApplyingEdit = true` → `onDidChangeTextDocument` 跳過此次

### 關鍵設計決策

1. **SemanticCore 在 Extension Host**: Lift 和 Generate 在 Node.js 執行，因為需要 tree-sitter（WASM 可在 Node.js 載入）。WebView 只負責 Blockly 渲染和使用者互動。

2. **Render 在 WebView**: `PatternRenderer.render(tree)` 產出 Blockly 狀態，這個操作在 WebView 中執行（因為需要 Blockly 的 serialization API）。Extension Host 傳送 SemanticNode tree，WebView 自行轉換為 Blockly 狀態。

3. **Extract 在 WebView**: `PatternExtractor.extract()` 從 Blockly workspace 提取 SemanticNode tree，在 WebView 中執行。結果透過 postMessage 傳回 Extension Host。

4. **BlockSpecRegistry 兩邊都需要**: Extension Host 需要 specs 來驅動 Lifter/Generator，WebView 需要 specs 來驅動 Renderer/Extractor/Registrar。兩邊各自載入 JSON 並初始化。

5. **不修改 src/**: Extension 透過 import 重用現有模組，不改動原始碼。如果需要 adapter，在 `vscode-ext/src/` 中寫。

## 複雜度追蹤

本功能無憲法違反項目，不需追蹤。
