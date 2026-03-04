# 研究報告：程式碼與 Blockly 積木雙向轉換工具

## 技術選型

### 1. C/C++ Parser（瀏覽器端）

**決策**: web-tree-sitter + tree-sitter-c / tree-sitter-cpp

**理由**:
- tree-sitter 是目前最成熟的增量解析器，官方提供 WASM 版本可在瀏覽器執行
- C 和 C++ 語法套件由官方維護，涵蓋完整語法
- 產出 Concrete Syntax Tree（CST），每個 token 都在樹中，可精確映射
- 支援增量解析，適合即時編輯場景
- Query API 支援 S-expression 模式匹配，適合積木映射

**替代方案**:
- Lezer（CodeMirror 內建）：較輕量但 C++ 語法支援不如 tree-sitter 成熟
- libclang via Emscripten：完整但 WASM 檔案過大（10+ MB）

**已知限制**:
- 不執行預處理器（#include、#define 不會展開），以 CST 節點呈現
- WASM 檔案需正確 MIME type 和 CORS 設定
- 首次載入 WASM 有延遲（core ~200KB + grammar ~200KB）

**版本**: web-tree-sitter 0.26.6, tree-sitter-c 0.24.1, tree-sitter-cpp 0.23.4

### 2. 程式碼編輯器

**決策**: CodeMirror 6 + @codemirror/lang-cpp

**理由**:
- 極度模組化，只載入需要的功能
- Bundle 大小約 40-50 KB gzipped（Monaco 約 700KB+）
- 原生 TypeScript 支援
- @codemirror/lang-cpp 提供 C/C++ 語法高亮
- EditorView.updateListener 提供變更事件，適合雙向同步
- basicSetup 包含行號、括號匹配等基礎功能

**替代方案**:
- Monaco Editor：功能過多（本質是 VS Code 編輯器），bundle 過大
- CodeJar + Prism：極輕量（~5KB）但編輯體驗較陽春
- Ace Editor：成熟但架構較舊，不可 tree-shake

**版本**: codemirror 6.0.2, @codemirror/lang-cpp 6.0.3

### 3. Blockly

**決策**: blockly（npm 套件）

**理由**:
- Google 官方維護的視覺化程式設計函式庫
- 支援 JSON 格式定義自訂積木（適合我們的積木定義規範）
- 內建 code generator 機制，可建立自訂語言的 generator
- 支援 JSON 序列化工作區（Blockly.serialization）
- 可動態註冊積木類型（Blockly.common.defineBlocks）
- 工具箱可動態更新（workspace.updateToolbox）
- 包含 TypeScript 型別定義

**關鍵 API**:
- `Blockly.common.defineBlocks()`: 動態註冊積木
- `Blockly.serialization.workspaces.save/load()`: JSON 序列化
- `Blockly.CodeGenerator`: 建立自訂程式碼產生器的基礎類別
- `workspace.updateToolbox()`: 動態更新工具箱

**版本**: blockly 12.4.1

### 4. 建置工具

**決策**: Vite + TypeScript

**理由**:
- 快速的開發伺服器（HMR）
- 原生 TypeScript 支援
- 對 WASM 檔案的處理較 webpack 簡單
- 輕量設定

**版本**: vite 7.x（最新）

### 5. 測試框架

**決策**: Vitest

**理由**:
- 與 Vite 原生整合，零額外設定
- 相容 Jest API
- 支援 TypeScript
- 支援 DOM 測試（happy-dom / jsdom）

## 積木定義規範格式

**決策**: JSON 格式

**理由**:
- Blockly 原生支援 JSON 格式定義積木外觀
- 容易驗證（JSON Schema）
- 容易在瀏覽器中解析
- 使用者可用任何文字編輯器撰寫
