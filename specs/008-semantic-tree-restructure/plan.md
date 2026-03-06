# Implementation Plan: Semantic Tree Restructure

**Branch**: `008-semantic-tree-restructure` | **Date**: 2026-03-06 | **Spec**: [spec.md](./spec.md)

## Summary

基於第一性原理文件（docs/first-principles.md），從頭重構整個 code-blockly 專案。核心變更：建立顯式語義樹（SemanticNode）作為 Single Source of Truth，實作四級 lift() 管線、三層概念代數、參數化投影（Language × Style × Locale）、漸進揭露（L0/L1/L2）。UI 採用 VSCode 風格佈局，程式碼編輯器從 CodeMirror 切換為 Monaco Editor。

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Blockly 12.x, Monaco Editor (最新穩定版), web-tree-sitter 0.26.x, Vite 7.x
**Storage**: localStorage（自動儲存）+ JSON 檔案匯出匯入
**Testing**: Vitest + happy-dom
**Target Platform**: 現代瀏覽器（Chrome/Firefox/Edge/Safari）
**Project Type**: Web Application（單頁應用，無後端）
**Performance Goals**: 積木→程式碼同步 ≤300ms，程式碼→積木同步 ≤500ms，投影參數切換 ≤200ms
**Constraints**: 純前端，無伺服器依賴；所有 WASM 資源（tree-sitter）本地載入
**Scale/Scope**: 教學用途，程式碼 ≤500 行，積木 ≤200 個

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 狀態 | 說明 |
|------|------|------|
| I. 簡約優先 | ✅ 通過 | 所有設計決策都有明確的當前需求支撐（語義樹是核心架構需求，不是假設性擴充） |
| II. 測試驅動開發 | ✅ 通過 | 計畫遵循 TDD：先寫測試再實作，每個 User Story 可獨立測試 |
| III. Git 紀律 | ✅ 通過 | 實作分階段 commit，每完成一個邏輯步驟即 commit |
| IV. 規格文件保護 | ✅ 通過 | 重構只動 src/ 和 tests/，不動 specs/ 和 .specify/ |
| V. 繁體中文優先 | ✅ 通過 | 規格文件均為繁體中文，程式碼變數名為英文 |

## Project Structure

### Documentation (this feature)

```text
specs/008-semantic-tree-restructure/
├── spec.md
├── plan.md              # 本文件
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── semantic-tree-api.md
│   └── block-spec-json.md
└── tasks.md             # /speckit.tasks 產出
```

### Source Code (repository root)

```text
src/
├── core/                        # 核心引擎（語義樹、概念、投影）
│   ├── semantic-tree.ts         # SemanticNode 資料結構 + 操作函式
│   ├── concept-registry.ts      # 三層概念註冊表
│   ├── block-spec-registry.ts   # BlockSpec 載入 + 查詢
│   ├── projection/              # 投影管線
│   │   ├── code-generator.ts    # project(tree) → code
│   │   └── block-renderer.ts    # project(tree) → blocks
│   ├── lift/                    # 語義提升管線
│   │   ├── lifter.ts            # lift(AST) → SemanticNode（四級策略）
│   │   ├── lift-context.ts      # 作用域符號表
│   │   └── pattern-matcher.ts   # AST pattern → concept 匹配
│   ├── storage.ts               # localStorage 持久化 + 匯出匯入
│   └── types.ts                 # 核心型別定義
│
├── blocks/                      # Universal 積木定義
│   └── universal.json           # L0/L1/L2 Universal 概念
│
├── languages/                   # 語言模組
│   └── cpp/
│       ├── module.ts            # C++ 語言模組進入點
│       ├── lifters/             # C++ 專屬 lifter（AST → SemanticNode）
│       │   ├── declarations.ts
│       │   ├── expressions.ts
│       │   ├── statements.ts
│       │   └── io.ts
│       ├── generators/          # C++ 專屬 generator（SemanticNode → code）
│       │   ├── declarations.ts
│       │   ├── expressions.ts
│       │   ├── statements.ts
│       │   └── io.ts
│       ├── blocks/              # C++ 積木定義（JSON）
│       │   ├── core.json        # Lang-Core（指標、struct、switch 等）
│       │   └── stdlib/          # Lang-Library
│       │       ├── io.json
│       │       ├── containers.json
│       │       └── algorithms.json
│       └── styles/              # Style preset 定義
│           ├── apcs.json
│           ├── competitive.json
│           └── google.json
│
├── i18n/                        # 國際化
│   ├── loader.ts
│   ├── en/
│   │   ├── blocks.json
│   │   └── types.json
│   └── zh-TW/
│       ├── blocks.json
│       └── types.json
│
├── interpreter/                 # 程式執行引擎（保留既有架構）
│   ├── interpreter.ts
│   ├── scope.ts
│   ├── io.ts
│   ├── errors.ts
│   └── types.ts
│
├── ui/                          # VSCode 風格 UI
│   ├── app.ts                   # 主控制器（佈局管理 + 同步協調）
│   ├── layout/                  # 佈局元件
│   │   ├── split-pane.ts        # 可調大小的分割面板
│   │   ├── sidebar.ts           # 左側 sidebar
│   │   └── status-bar.ts        # 底部狀態列
│   ├── panels/                  # 面板元件
│   │   ├── blockly-panel.ts     # Blockly 積木編輯器面板
│   │   ├── monaco-panel.ts      # Monaco Editor 程式碼面板
│   │   ├── console-panel.ts     # Console 輸出面板
│   │   └── variable-panel.ts    # 變數檢視面板
│   ├── toolbar/                 # 頂部工具列
│   │   ├── toolbar.ts           # 工具列容器
│   │   ├── language-selector.ts # Language 切換
│   │   ├── style-selector.ts    # Style 切換
│   │   ├── locale-selector.ts   # Locale 切換
│   │   ├── level-selector.ts    # L0/L1/L2 切換
│   │   └── sync-button.ts       # 同步按鈕
│   ├── sync-controller.ts       # 同步狀態機
│   └── style.css                # 全域樣式
│
└── main.ts                      # 進入點

tests/
├── unit/
│   ├── core/
│   │   ├── semantic-tree.test.ts
│   │   ├── concept-registry.test.ts
│   │   ├── block-spec-registry.test.ts
│   │   ├── code-generator.test.ts
│   │   ├── block-renderer.test.ts
│   │   ├── lifter.test.ts
│   │   ├── lift-context.test.ts
│   │   └── storage.test.ts
│   ├── languages/
│   │   └── cpp/
│   │       ├── lifters.test.ts
│   │       └── generators.test.ts
│   └── ui/
│       └── sync-controller.test.ts
├── integration/
│   ├── roundtrip.test.ts
│   ├── projection.test.ts
│   ├── lift-pipeline.test.ts
│   ├── style-switching.test.ts
│   ├── locale-switching.test.ts
│   └── level-switching.test.ts
└── fixtures/
    ├── code-samples/
    └── semantic-trees/
```

**Structure Decision**: 採用單一專案結構，將現有的 `src/` 重新組織為 `core/`（引擎）、`ui/`（VSCode 風格介面）、`languages/`（語言模組）三大模組。`core/` 進一步拆分為 `projection/`（投影管線）和 `lift/`（語義提升管線），對應第一性原理中的雙向管線。UI 層拆分為 `layout/`（佈局骨架）、`panels/`（各面板）、`toolbar/`（投影參數控制），反映 VSCode 風格的佈局結構。

## Implementation Phases

### Phase A: 核心引擎（Core Engine）

**目標**: 建立語義樹、概念註冊表、投影管線、lift 管線的核心邏輯，全部可單元測試，不依賴 UI。

**涵蓋 FR**: FR-001~FR-012, FR-027~FR-028

**步驟**:
1. 定義核心型別（SemanticNode, ConceptDef, BlockSpec 等）
2. 實作 SemanticTree 操作函式（建立、修改、序列化）
3. 實作 ConceptRegistry（三層概念註冊 + 查詢）
4. 實作 BlockSpecRegistry（JSON 載入 + AST pattern 匹配）
5. 實作 code-generator（語義樹 → 程式碼）
6. 實作 lifter（AST → 語義樹，四級策略）
7. 實作 LiftContext（作用域符號表）
8. 遷移既有 Universal 積木定義為新 JSON 格式（含 concept 欄位）
9. 遷移既有 C++ 積木定義為新 JSON 格式
10. Round-trip 測試：code → AST → lift → tree → project → code

### Phase B: 參數化投影（Parameterized Projection）

**目標**: 實作 Style / Locale / Level 三個正交參數的投影切換。

**涵蓋 FR**: FR-013~FR-019

**步驟**:
1. 定義 StylePreset JSON 格式 + 三個預設（APCS、競賽、Google）
2. 實作 code-generator 的 Style 參數化（io_style、brace_style、indent 等）
3. 實作 block-renderer 的 Locale 參數化（message/tooltip 切換）
4. 實作 block-renderer 的 Level 過濾（概念層級降級）
5. 測試：切換 Style 後 round-trip 正確、切換 Locale 後積木文字正確、切換 Level 後降級正確

### Phase C: VSCode 風格 UI

**目標**: 建立 VSCode 風格的編輯器佈局，整合 Blockly 和 Monaco Editor。

**涵蓋 FR**: FR-029~FR-031, FR-041~FR-043

**步驟**:
1. 移除 CodeMirror 依賴，安裝 Monaco Editor
2. 建立 VSCode 風格佈局骨架（split-pane、sidebar、status-bar）
3. 實作 blockly-panel（Blockly workspace + Zelos renderer）
4. 實作 monaco-panel（Monaco Editor + C++ 語法高亮）
5. 實作 toolbar（Language / Style / Locale / Level 選擇器 + 同步按鈕）
6. 實作 console-panel（程式輸出顯示）
7. 整合 CSS 樣式（VSCode 深色/淺色主題）

### Phase D: 同步機制與持久化

**目標**: 實作積木↔程式碼的同步控制器，以及 localStorage 持久化 + 匯出匯入。

**涵蓋 FR**: FR-003, FR-032~FR-040

**步驟**:
1. 實作 sync-controller（同步狀態機）
2. 積木 → 程式碼自動同步（Blockly change event → 更新語義樹 → project → Monaco）
3. 程式碼 → 積木手動同步（同步按鈕 → parse → lift → 更新語義樹 → project → Blockly）
4. 語法錯誤處理（錯誤提示 + 使用者確認 + 部分同步）
5. 實作 storage service（localStorage 自動儲存 + 恢復）
6. 實作匯出/匯入 JSON 檔案
7. 錯誤處理（localStorage 空間不足、匯入格式不合法）

### Phase E: 註解處理與元資訊

**目標**: 實作註解的雙向保留。

**涵蓋 FR**: FR-023~FR-026

**步驟**:
1. lift() 中處理 tree-sitter 的 comment 節點 → Annotation / comment SemanticNode
2. project() 中將 Annotation 還原為程式碼註解
3. block-renderer 中將 Annotation 顯示為 Blockly block comment
4. 語法偏好偵測與保留（compound_assign、increment 等）

### Phase F: 整合測試與收尾

**目標**: 端對端測試、效能驗證、文件更新。

**涵蓋 SC**: SC-001~SC-009

**步驟**:
1. 端對端 round-trip 測試（所有 Universal + C++ 積木）
2. 效能測試（同步延遲、投影切換速度）
3. Edge case 測試（空程式碼、深巢狀、超長行、語法錯誤）
4. 更新 index.html 入口頁面
5. 更新 package.json 依賴（移除 codemirror，加入 monaco-editor）
6. 清理舊程式碼（移除不再使用的模組）

## Key Dependencies Between Phases

```
Phase A (核心引擎)
  ↓
Phase B (參數化投影) ← 依賴 A 的概念註冊 + 投影管線
  ↓
Phase C (VSCode UI) ← 可與 B 平行開發，但整合需要 A
  ↓
Phase D (同步 + 持久化) ← 依賴 A + C（需要兩端面板都就緒）
  ↓
Phase E (註解處理) ← 依賴 A 的 lift + project
  ↓
Phase F (整合測試) ← 依賴所有前置階段
```

## Risk Mitigation

| 風險 | 影響 | 緩解策略 |
|------|------|---------|
| Monaco Editor 打包體積大 | 載入速度慢 | 使用 Vite 的 dynamic import + monaco-editor-webpack-plugin 等效方案做程式碼分割 |
| tree-sitter WASM 載入失敗 | 無法 parse | 保留既有的 WASM 載入機制，加入 retry + fallback 提示 |
| Blockly + Monaco 佈局衝突 | resize 問題 | 使用 ResizeObserver 監聽面板大小變化，主動通知兩個編輯器重新 layout |
| lift() 四級策略複雜度 | 開發時間長 | 先只實作 Level 1 + Level 4（結構匹配 + raw_code），Level 2/3 漸進加入 |

## Complexity Tracking

無 Constitution 違規，不需要記錄。
