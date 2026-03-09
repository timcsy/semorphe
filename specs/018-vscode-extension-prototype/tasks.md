# 任務：VSCode Extension 原型

**輸入**: `specs/018-vscode-extension-prototype/` 下的設計文件
**前置條件**: plan.md、spec.md、research.md、data-model.md、contracts/、quickstart.md

## 格式: `[ID] [P?] [Story] 描述`

- **[P]**: 可平行執行（不同檔案、無依賴）
- **[Story]**: 所屬使用者故事（US1、US2、US3）
- 描述中包含確切的檔案路徑

---

## Phase 1: Setup（專案初始化）

**目的**: 建立 VSCode extension 專案結構與建置配置

- [x] T001 建立 `vscode-ext/` 目錄結構：`src/`、`src/webview/`、`media/blockly/`、`dist/`
- [x] T002 建立 `vscode-ext/package.json`：extension manifest，含 activationEvents（`onLanguage:cpp`、`onLanguage:c`）、contributes（commands、configuration、menus）
- [x] T003 [P] 建立 `vscode-ext/tsconfig.json`：Node.js target、strict mode、path mapping 指向 `../src/`
- [x] T004 [P] 建立 `vscode-ext/esbuild.mjs`：雙配置建置腳本（Extension Host = `platform: 'node'`、WebView = `platform: 'browser'`），含 WASM 檔案複製
- [x] T005 [P] 建立 `vscode-ext/.vscodeignore`：排除 `src/`、`node_modules/`、`*.ts` 等開發檔案
- [x] T006 安裝依賴：`npm install --save-dev @types/vscode esbuild`（在 vscode-ext/ 中）
- [x] T007 驗證建置腳本可執行：`node vscode-ext/esbuild.mjs` 產出 `dist/extension.js` 和 `dist/webview/main.js`

**檢查點**: 空殼 extension 可建置成功

---

## Phase 2: Foundational（基礎設施）

**目的**: Extension Host 的核心初始化，MUST 在任何 US 之前完成

- [x] T008 實作 `vscode-ext/src/semantic-core.ts`：封裝 SemanticCore 初始化
  - import CppParser、PatternLifter、CodeGenerator、PatternRenderer、PatternExtractor、TemplateGenerator、BlockSpecRegistry
  - 提供 `init(wasmDir)` 非同步方法：初始化 parser（指向 `dist/` 中的 WASM）、載入 block specs、建構 lifter/generator/renderer
  - 提供 `lift(code)` → SemanticNode、`generate(tree)` → string 方法
- [x] T009 實作 `vscode-ext/src/document-session.ts`：每文件語義狀態管理
  - `DocumentSession` 類別：uri、semanticTree、blocklyState、lastSyncSource
  - `DocumentSessionManager`：Map<string, DocumentSession>，提供 getOrCreate/get/delete
- [x] T010 實作 `vscode-ext/src/postmessage-bridge.ts`：postMessage 協議封裝
  - `BridgeMessage` 型別：`{ command: string, data: unknown }`
  - `PostMessageBridge` 類別：wrap WebviewPanel，提供 `send(command, data)` 和 `onMessage(handler)`
- [x] T011 實作 `vscode-ext/src/extension.ts`：activate/deactivate 骨架
  - `activate(context)`：初始化 SemanticCore、註冊命令、設定 disposables
  - `deactivate()`：清理資源
  - 尚不建立 WebView，只驗證 extension 可啟動

**檢查點**: Extension 可安裝並啟動（`vsce package` → VSIX → 安裝 → 無錯誤）

---

## Phase 3: User Story 1 — 程式碼與積木雙向轉換 (P1) 🎯 MVP

**目標**: 在 VSCode 中打開 C++ 檔案，開啟積木面板，實現雙向同步

**獨立測試**: 開啟 .cpp 檔案 → 開啟積木面板 → 修改程式碼確認積木更新 → 修改積木確認程式碼更新

### WebView 側

- [x] T012 [US1] 實作 `vscode-ext/src/webview/bridge-client.ts`：WebView 側 postMessage 封裝
  - `acquireVsCodeApi()` 呼叫（僅一次）
  - `send(command, data)` 和 `onMessage(handler)`
- [x] T013 [US1] 實作 `vscode-ext/src/webview/blockly-setup.ts`：Blockly 初始化
  - import BlockRegistrar、BlockSpecRegistry、buildToolbox、cognitive-levels
  - 載入 concept/projection JSON（打包進 WebView bundle）
  - 初始化 BlockSpecRegistry.loadFromSplit()
  - 初始化 BlockRegistrar.registerAll()
  - 建立 Blockly workspace（含 toolbox）
- [x] T014 [US1] 實作 `vscode-ext/src/webview/main.ts`：WebView 入口
  - 初始化 blockly-setup
  - 監聽 `semantic:update` → PatternRenderer.render(tree) → Blockly.serialization.workspaces.load()
  - 監聽 Blockly workspace change → PatternExtractor.extract() → 發送 `edit:blocks`
  - 發送 `webview:ready`
  - 含防無限迴圈 flag（`_isUpdatingFromHost`）

### Extension Host 側

- [x] T015 [US1] 實作 `vscode-ext/src/blocks-panel.ts`：WebviewPanel 管理
  - `createOrShow(extensionUri)`：建立 WebviewPanel，設定 CSP（`style-src 'unsafe-inline'`）、載入 webview bundle
  - `getWebviewContent(webview, extensionUri)`：產生 HTML（含 nonce、script src、style）
  - `dispose()` 清理
  - Blockly media 路徑透過 `asWebviewUri` 解析
- [x] T016 [US1] 實作 `vscode-ext/src/text-sync.ts`：TextDocument 監聯與回寫
  - `startWatching(document)`：監聽 `onDidChangeTextDocument`，debounce 300ms 後呼叫 `onCodeChange` callback
  - `applyCodeEdit(document, code)`：`WorkspaceEdit.replace()` + `applyEdit()`，含 `_isApplyingEdit` flag 防無限迴圈
  - `stopWatching()`
- [x] T017 [US1] 在 `vscode-ext/src/extension.ts` 中接線完整同步流程
  - 註冊 `codeBlockly.toggleBlocksPanel` 命令
  - 命令觸發 → `BlocksPanel.createOrShow()` + `PostMessageBridge` 建立
  - `webview:ready` → lift 當前文件程式碼 → `semantic:update` 推送
  - `edit:blocks` 接收 → `semanticCore.generate(tree)` → `textSync.applyCodeEdit()`
  - `onDidChangeTextDocument` → `semanticCore.lift(code)` → `semantic:update` 推送
  - `onDidChangeActiveTextEditor` → 切換 DocumentSession + 推送新語義樹

**檢查點**: 可在 VSCode 中完成 code → blocks → code round-trip

---

## Phase 4: User Story 2 — Extension 生命週期管理 (P2)

**目標**: 穩定的 extension 啟動/關閉、面板狀態記憶、多文件切換

**獨立測試**: 安裝 → 開關檔案 → 切換面板 → 重啟 VSCode → 面板恢復

- [x] T018 [US2] 在 `vscode-ext/src/extension.ts` 中實作面板狀態持久化
  - 使用 `context.workspaceState` 儲存 `panelVisible` 狀態
  - Extension 啟動時檢查狀態，自動恢復面板
- [x] T019 [US2] 在 `vscode-ext/src/blocks-panel.ts` 中實作 WebviewPanelSerializer
  - 實作 `vscode.WebviewPanelSerializer` 介面
  - `deserializeWebviewPanel(panel, state)` → 恢復面板內容
  - 在 `activate()` 中註冊 serializer
- [x] T020 [US2] 在 `vscode-ext/src/extension.ts` 中實作多文件切換
  - `onDidChangeActiveTextEditor` → 判斷是否為 C++ 檔案
  - C++ 檔案 → `document:switch`（帶 session 語義樹）
  - 非 C++ 檔案 → `document:empty`
  - DocumentSession 快取每個文件的最新語義樹
- [x] T021 [US2] 在 `vscode-ext/src/blocks-panel.ts` 中實作面板 dispose 清理
  - `panel.onDidDispose()` → 清理所有 event listeners、停止 TextSync
  - 更新 workspaceState 中的 panelVisible = false
- [x] T022 [US2] 在 `vscode-ext/src/webview/main.ts` 中處理 `document:switch` 和 `document:empty`
  - `document:switch` → 用新語義樹重新渲染積木
  - `document:empty` → 清空 workspace，顯示「請開啟 C++ 檔案」訊息

**檢查點**: Extension 生命週期穩定，面板狀態跨重啟持久化

---

## Phase 5: User Story 3 — 認知層級篩選 (P3)

**目標**: 透過 extension 設定控制工具箱顯示的積木層級

**獨立測試**: 修改 `codeBlockly.cognitiveLevel` 設定 → 積木面板工具箱更新

- [x] T023 [US3] 在 `vscode-ext/src/extension.ts` 中監聽設定變更
  - `vscode.workspace.onDidChangeConfiguration` → 偵測 `codeBlockly.cognitiveLevel` 變更
  - 發送 `config:level` 到 WebView
- [x] T024 [US3] 在 `vscode-ext/src/webview/main.ts` 中處理 `config:level`
  - 收到 `config:level` → 呼叫 `buildToolbox(newLevel)` → `workspace.updateToolbox()`
- [x] T025 [US3] 在 `vscode-ext/src/extension.ts` 的 `activate()` 中讀取初始認知層級
  - 從 `vscode.workspace.getConfiguration('codeBlockly').get('cognitiveLevel')` 讀取
  - 傳入 WebView 的初始 `semantic:update` 訊息中

**檢查點**: 認知層級設定控制工具箱顯示

---

## Phase 6: Polish & 跨功能優化

**目的**: 邊界案例處理、穩定性、文件

- [x] T026 在 `vscode-ext/src/text-sync.ts` 中處理語法錯誤容忍
  - lift 失敗時 catch error，發送部分語義樹（如果有的話）或空樹
  - 不讓 extension crash
- [x] T027 在 `vscode-ext/src/webview/main.ts` 中處理 WebView 載入失敗
  - try/catch Blockly 初始化
  - 失敗時顯示錯誤訊息 HTML
- [x] T028 在根目錄執行 `npm test` 驗證現有 1507+ 測試全通過（FR-012）
- [x] T029 在根目錄執行 `npm run build` 驗證瀏覽器版建置不受影響（FR-012）
- [ ] T030 執行 quickstart.md 的 5 個驗證場景，手動確認
- [x] T031 建立 `vscode-ext/README.md`：安裝說明（`vsce package` → VSIX）、使用方式、已知限制

---

## 依賴與執行順序

### Phase 依賴

- **Phase 1 (Setup)**: 無依賴，立即開始
- **Phase 2 (Foundational)**: 依賴 Phase 1 完成
- **Phase 3 (US1)**: 依賴 Phase 2 完成 — **MVP**
- **Phase 4 (US2)**: 依賴 Phase 3 完成（需要 blocks-panel 和 extension.ts 基礎）
- **Phase 5 (US3)**: 依賴 Phase 3 完成
- **Phase 6 (Polish)**: 依賴所有 US 完成

### User Story 依賴

- **US1 (P1)**: Foundation 完成後可開始，無其他依賴
- **US2 (P2)**: 需要 US1 的 blocks-panel.ts 和 extension.ts 基礎
- **US3 (P3)**: 需要 US1 的 WebView 基礎，可與 US2 平行

### 平行機會

Phase 1 內:
- T003、T004、T005 可平行（不同檔案）

Phase 3 內:
- T012、T013 可與 T015、T016 平行（WebView 側 vs Extension Host 側）

Phase 4 和 Phase 5:
- US2 和 US3 在 US1 完成後可平行

---

## 平行執行範例：User Story 1

```bash
# WebView 側和 Extension Host 側可平行開發：
# 團隊 A（WebView）:
T012: bridge-client.ts
T013: blockly-setup.ts
T014: main.ts

# 團隊 B（Extension Host）:
T015: blocks-panel.ts
T016: text-sync.ts

# 最後整合：
T017: extension.ts 接線
```

---

## 實作策略

### MVP 優先（僅 User Story 1）

1. 完成 Phase 1: Setup（T001-T007）
2. 完成 Phase 2: Foundational（T008-T011）
3. 完成 Phase 3: User Story 1（T012-T017）
4. **停下驗證**: 在 VSCode 中測試 code ↔ blocks round-trip
5. 可交付 demo

### 增量交付

1. Setup + Foundational → 空殼 extension 可安裝
2. + US1 → 核心 round-trip 可用（**MVP!**）
3. + US2 → 生命週期穩定
4. + US3 → 認知層級可設定
5. + Polish → 邊界案例處理、文件

---

## 備註

- Extension 程式碼全部在 `vscode-ext/` 中，不修改 `src/` 下的任何檔案
- 透過相對路徑 import 重用 `src/core/` 和 `src/languages/` 模組
- WASM 檔案從 `public/` 複製到 `vscode-ext/dist/`
- Blockly media 從 `node_modules/blockly/media/` 複製到 `vscode-ext/media/blockly/`
- 每完成一個 task 或一組相關 tasks 後 commit
