# Tasks: Semantic Tree Restructure

**Input**: Design documents from `/specs/008-semantic-tree-restructure/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: 本專案憲法要求 TDD（測試驅動開發），所有 User Story 包含測試任務。

**Organization**: 任務按 User Story 分組，每個 Story 可獨立實作和測試。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可平行執行（不同檔案，無依賴）
- **[Story]**: 所屬 User Story（US1~US9）

---

## Phase 1: Setup（專案初始化）

**Purpose**: 更新依賴、建立新的目錄結構

- [ ] T001 更新 package.json：移除 codemirror 相關依賴，新增 monaco-editor
- [ ] T002 建立新的目錄結構：src/core/、src/core/projection/、src/core/lift/、src/ui/layout/、src/ui/panels/、src/ui/toolbar/、src/languages/cpp/lifters/、src/languages/cpp/generators/、src/languages/cpp/styles/
- [ ] T003 [P] 設定 Vite 支援 Monaco Editor（vite-plugin-monaco-editor 或 worker 設定）in vite.config.ts
- [ ] T004 [P] 建立新的測試目錄結構：tests/unit/core/、tests/unit/languages/cpp/、tests/unit/ui/、tests/integration/、tests/fixtures/code-samples/、tests/fixtures/semantic-trees/

---

## Phase 2: Foundational（核心基礎設施）

**Purpose**: 語義樹、概念註冊表、積木規格註冊表——所有 User Story 的前置依賴

**⚠️ CRITICAL**: 所有 User Story 都依賴此階段完成

### 測試（先寫，確認 Red）

- [ ] T005 [P] 撰寫 SemanticNode 資料結構的單元測試 in tests/unit/core/semantic-tree.test.ts
- [ ] T006 [P] 撰寫 ConceptRegistry 三層概念註冊與查詢的單元測試 in tests/unit/core/concept-registry.test.ts
- [ ] T007 [P] 撰寫 BlockSpecRegistry JSON 載入與 AST pattern 匹配的單元測試 in tests/unit/core/block-spec-registry.test.ts

### 實作

- [ ] T008 定義核心型別（SemanticNode, ConceptDef, BlockSpec, Annotation, NodeMetadata, LiftContext, StylePreset, WorkspaceState）in src/core/types.ts
- [ ] T009 實作 SemanticTree 操作函式（createEmpty, addChild, removeChild, updateProperty, findById, toJSON, fromJSON）in src/core/semantic-tree.ts
- [ ] T010 實作 ConceptRegistry（三層概念註冊 + 按 layer/level 查詢 + findAbstract）in src/core/concept-registry.ts
- [ ] T011 實作 BlockSpecRegistry（loadFromJSON + getByConceptId + getByAstPattern + listByCategory）in src/core/block-spec-registry.ts
- [ ] T012 遷移既有 Universal 積木定義為新 JSON 格式（新增 level、concept 欄位）in src/blocks/universal.json
- [ ] T013 [P] 遷移既有 C++ core 積木定義為新 JSON 格式 in src/languages/cpp/blocks/core.json
- [ ] T014 [P] 遷移既有 C++ stdlib I/O 積木定義為新 JSON 格式 in src/languages/cpp/blocks/stdlib/io.json
- [ ] T015 [P] 遷移既有 i18n 翻譯檔更新（配合新積木 ID 和新增的 message key）in src/i18n/zh-TW/blocks.json 和 src/i18n/en/blocks.json
- [ ] T016 更新 i18n loader 以支援新的 JSON 格式 in src/i18n/loader.ts

**Checkpoint**: 核心資料結構和註冊表就緒，所有 T005~T007 測試通過

---

## Phase 3: User Story 1 - 積木拖拉即時同步程式碼 (Priority: P1) 🎯 MVP

**Goal**: 使用者拖拉積木，程式碼面板即時顯示對應 C++ 程式碼

**Independent Test**: 拖入積木組合，程式碼面板即時更新且語法正確

### 測試

- [ ] T017 [P] [US1] 撰寫 code-generator 單元測試（語義樹 → C++ 程式碼）in tests/unit/core/code-generator.test.ts
- [ ] T018 [P] [US1] 撰寫 C++ generator 單元測試（各概念的程式碼生成）in tests/unit/languages/cpp/generators.test.ts

### 實作

- [ ] T019 [US1] 實作 code-generator 框架（遍歷語義樹 + 委派給語言模組）in src/core/projection/code-generator.ts
- [ ] T020 [US1] 實作 C++ declarations generator（var_declare, var_assign, array_declare）in src/languages/cpp/generators/declarations.ts
- [ ] T021 [P] [US1] 實作 C++ expressions generator（arithmetic, compare, logic, var_ref, literals）in src/languages/cpp/generators/expressions.ts
- [ ] T022 [P] [US1] 實作 C++ statements generator（if, count_loop, while_loop, break, continue, func_def, func_call, return）in src/languages/cpp/generators/statements.ts
- [ ] T023 [P] [US1] 實作 C++ I/O generator（print, input, endl）in src/languages/cpp/generators/io.ts
- [ ] T024 [US1] 實作 C++ language module 進入點（整合所有 generator）in src/languages/cpp/module.ts
- [ ] T025 [US1] 建立 VSCode 風格佈局骨架（split-pane、sidebar 佔位）in src/ui/layout/split-pane.ts 和 src/ui/layout/sidebar.ts
- [ ] T026 [US1] 實作 Blockly 面板（Blockly workspace + Zelos renderer + Scratch 配色 + 工具箱建構）in src/ui/panels/blockly-panel.ts
- [ ] T027 [US1] 實作 Monaco Editor 面板（C++ 語法高亮 + 唯讀模式用於此 Story）in src/ui/panels/monaco-panel.ts
- [ ] T028 [US1] 實作同步控制器的積木→程式碼方向（Blockly change event → 讀取積木 → 建構語義樹 → project → 寫入 Monaco）in src/ui/sync-controller.ts
- [ ] T029 [US1] 實作主控制器 App（初始化各面板 + 連接同步控制器）in src/ui/app.ts
- [ ] T030 [US1] 實作全域 CSS 樣式（VSCode 風格深色主題 + 面板佈局）in src/ui/style.css
- [ ] T031 [US1] 更新 index.html 和 main.ts 進入點 in index.html 和 src/main.ts

**Checkpoint**: 拖拉積木後程式碼即時更新。US1 可獨立演示。

---

## Phase 4: User Story 2 - 程式碼輸入手動同步積木 (Priority: P1)

**Goal**: 使用者在 Monaco 輸入程式碼，按同步按鈕後積木面板顯示對應積木

**Independent Test**: 輸入 C++ 程式碼，按同步，積木面板正確顯示

### 測試

- [ ] T032 [P] [US2] 撰寫 lifter 單元測試（AST → SemanticNode，Level 1 結構匹配 + Level 4 raw_code 降級）in tests/unit/core/lifter.test.ts
- [ ] T033 [P] [US2] 撰寫 C++ lifters 單元測試（各 AST 節點類型的提升）in tests/unit/languages/cpp/lifters.test.ts
- [ ] T034 [P] [US2] 撰寫 block-renderer 單元測試（語義樹 → Blockly workspace state）in tests/unit/core/block-renderer.test.ts
- [ ] T035 [P] [US2] 撰寫 sync-controller 單元測試（同步狀態機 + 錯誤處理流程）in tests/unit/ui/sync-controller.test.ts
- [ ] T036 [P] [US2] 撰寫 round-trip 整合測試（code → blocks → code 語義不變）in tests/integration/roundtrip.test.ts

### 實作

- [ ] T037 [US2] 實作 pattern-matcher（AST pattern → concept 匹配引擎，讀取 BlockSpec 的 astPattern）in src/core/lift/pattern-matcher.ts
- [ ] T038 [US2] 實作 lifter 框架（遍歷 AST + pattern match + 四級策略分派 + raw_code 降級）in src/core/lift/lifter.ts
- [ ] T039 [US2] 實作 C++ declarations lifter（declaration, init_declarator → var_declare/var_assign）in src/languages/cpp/lifters/declarations.ts
- [ ] T040 [P] [US2] 實作 C++ expressions lifter（binary_expression, unary_expression, identifier, number/string_literal → 對應概念）in src/languages/cpp/lifters/expressions.ts
- [ ] T041 [P] [US2] 實作 C++ statements lifter（if_statement, for_statement, while_statement, function_definition → 對應概念）in src/languages/cpp/lifters/statements.ts
- [ ] T042 [P] [US2] 實作 C++ I/O lifter（cout/printf call_expression → print，cin/scanf → input）in src/languages/cpp/lifters/io.ts
- [ ] T043 [US2] 實作 block-renderer（語義樹 → Blockly workspace XML/JSON，遍歷樹建構 block 結構）in src/core/projection/block-renderer.ts
- [ ] T044 [US2] 實作 tree-sitter 整合（載入 WASM + parse C++ 程式碼 → AST）in src/languages/cpp/module.ts（擴充 parse 方法）
- [ ] T045 [US2] 開啟 Monaco Editor 的可編輯模式，新增同步按鈕 in src/ui/toolbar/sync-button.ts
- [ ] T046 [US2] 實作 sync-controller 的程式碼→積木方向（按鈕觸發 → parse → lift → 更新語義樹 → project → 寫入 Blockly）in src/ui/sync-controller.ts（擴充）
- [ ] T047 [US2] 實作語法錯誤處理（parse 結果含 ERROR 節點 → 提示使用者 + 標示位置 → 使用者確認 → 部分同步）in src/ui/sync-controller.ts（擴充）

**Checkpoint**: 雙向同步完整運作。US1+US2 可獨立演示。

---

## Phase 5: User Story 3 - 四級 lift() 優雅降級 (Priority: P1)

**Goal**: lift() 支援完整四級策略，未知結構不崩潰，保留所有資訊

**Independent Test**: 輸入含 template、巨集、operator overloading 的程式碼，系統正確降級不崩潰

### 測試

- [ ] T048 [P] [US3] 撰寫 LiftContext 單元測試（作用域符號表 + 變數遮蔽 + 型別推導）in tests/unit/core/lift-context.test.ts
- [ ] T049 [P] [US3] 撰寫四級 lift 整合測試（Level 1~4 各級降級場景）in tests/integration/lift-pipeline.test.ts

### 實作

- [ ] T050 [US3] 實作 LiftContext（作用域棧 + 符號表 + using_directives + includes + macro_definitions）in src/core/lift/lift-context.ts
- [ ] T051 [US3] 擴充 lifter 支援 Level 2 上下文推導（查找 declaration 消歧 + confidence 標籤）in src/core/lift/lifter.ts（擴充）
- [ ] T052 [US3] 擴充 lifter 支援 Level 3 未決保留（unresolved_binary_op, unresolved_macro + 引數子樹獨立 lift）in src/core/lift/lifter.ts（擴充）
- [ ] T053 [US3] 實作 unresolved 節點和 raw_code 積木的視覺呈現（不同邊框/色調 + 展開/收合）in src/ui/panels/blockly-panel.ts（擴充）

**Checkpoint**: 任何合法 C++ 程式碼都能被處理，不崩潰。

---

## Phase 6: User Story 4 - 漸進揭露認知層級切換 (Priority: P2)

**Goal**: 使用者可切換 L0/L1/L2，工具箱和積木顯示相應變化

**Independent Test**: 切換層級後工具箱數量改變，超出層級的積木正確降級

### 測試

- [ ] T054 [P] [US4] 撰寫認知層級切換整合測試（L0/L1/L2 工具箱過濾 + 積木降級/升級）in tests/integration/level-switching.test.ts

### 實作

- [ ] T055 [US4] 實作 level-selector（L0/L1/L2 分段按鈕）in src/ui/toolbar/level-selector.ts
- [ ] T056 [US4] 實作工具箱根據認知層級過濾積木（讀取 BlockSpec.level + 動態重建 toolbox）in src/ui/panels/blockly-panel.ts（擴充）
- [ ] T057 [US4] 實作超出層級的積木降級顯示（L2 專屬積木在 L0 降級為 func_call 通用積木）in src/core/projection/block-renderer.ts（擴充）
- [ ] T058 [US4] 實作切換層級時已有積木的升級/降級轉換 in src/ui/sync-controller.ts（擴充）

**Checkpoint**: L0/L1/L2 切換正常運作。

---

## Phase 7: User Story 5 - 參數化投影 Language × Style × Locale (Priority: P2)

**Goal**: 三個正交參數可獨立切換，語義樹不變

**Independent Test**: 切換 Style 後 cout↔printf 互換，切換 Locale 後積木文字變語言

### 測試

- [ ] T059 [P] [US5] 撰寫 Style 切換整合測試（APCS ↔ 競賽 ↔ Google，code output 差異驗證）in tests/integration/style-switching.test.ts
- [ ] T060 [P] [US5] 撰寫 Locale 切換整合測試（zh-TW ↔ en，積木 message 差異驗證）in tests/integration/locale-switching.test.ts

### 實作

- [ ] T061 [P] [US5] 建立 APCS style preset JSON in src/languages/cpp/styles/apcs.json
- [ ] T062 [P] [US5] 建立競賽 style preset JSON in src/languages/cpp/styles/competitive.json
- [ ] T063 [P] [US5] 建立 Google style preset JSON in src/languages/cpp/styles/google.json
- [ ] T064 [US5] 擴充 code-generator 接受 StylePreset 參數（io_style, brace_style, indent_size, naming_convention, header_style）in src/core/projection/code-generator.ts（擴充）
- [ ] T065 [US5] 擴充 block-renderer 接受 locale 參數（message/tooltip 切換）in src/core/projection/block-renderer.ts（擴充）
- [ ] T066 [US5] 實作 style-selector in src/ui/toolbar/style-selector.ts
- [ ] T067 [P] [US5] 實作 locale-selector in src/ui/toolbar/locale-selector.ts
- [ ] T068 [P] [US5] 實作 language-selector（目前僅 C++，預留多語言介面）in src/ui/toolbar/language-selector.ts
- [ ] T069 [US5] 實作 toolbar 容器（整合所有 selector）in src/ui/toolbar/toolbar.ts
- [ ] T070 [US5] 語法偏好偵測與保留（lift 時記錄 compound_assign/increment 偏好到 metadata.syntaxPreference，project 時 best-effort 使用）in src/core/lift/lifter.ts 和 src/core/projection/code-generator.ts（擴充）

**Checkpoint**: Style/Locale/Language 切換均正常，語義樹不變。

---

## Phase 8: User Story 6 - 開放擴充 JSON-only 新增積木 (Priority: P2)

**Goal**: 新增 JSON 檔案即可加入新積木，無需修改既有 TypeScript 原始碼

**Independent Test**: 新增一個 sort 積木 JSON，重新載入後雙向轉換正確

### 測試

- [ ] T071 [P] [US6] 撰寫 JSON-only 擴充整合測試（新增 sort 積木 JSON → 載入 → code↔blocks round-trip）in tests/integration/json-extension.test.ts

### 實作

- [ ] T072 [US6] 實作 BlockSpecRegistry 的自動掃描（啟動時掃描 src/blocks/**/*.json 和 src/languages/*/blocks/**/*.json）in src/core/block-spec-registry.ts（擴充）
- [ ] T073 [US6] 建立範例 C++ stdlib algorithms 積木 JSON（sort, find）in src/languages/cpp/blocks/stdlib/algorithms.json
- [ ] T074 [US6] 建立範例 C++ stdlib containers 積木 JSON（vector_push_back, vector_size）in src/languages/cpp/blocks/stdlib/containers.json
- [ ] T075 [US6] 驗證 0 行既有 TypeScript 原始碼變更即可完成新積木的雙向轉換

**Checkpoint**: 開發者只需新增 JSON 檔案即可擴充系統。SC-003 達成。

---

## Phase 9: User Story 9 - 持久化與匯出匯入 (Priority: P2)

**Goal**: 語義樹自動存到 localStorage，可手動匯出/匯入 JSON

**Independent Test**: 建立積木 → 關閉 → 重新開啟 → 自動恢復；匯出的 JSON 可在另一瀏覽器匯入

### 測試

- [ ] T076 [P] [US9] 撰寫 storage service 單元測試（save/load/export/import + 容量不足處理）in tests/unit/core/storage.test.ts

### 實作

- [ ] T077 [US9] 實作 storage service（localStorage 自動儲存 + 啟動恢復 + 空間不足提示）in src/core/storage.ts
- [ ] T078 [US9] 實作匯出功能（語義樹 + 投影參數 → JSON Blob → 下載）in src/core/storage.ts（擴充）
- [ ] T079 [US9] 實作匯入功能（檔案選擇 → JSON 解析 → 格式驗證 → 恢復工作區）in src/core/storage.ts（擴充）
- [ ] T080 [US9] 在 toolbar 或 sidebar 新增匯出/匯入按鈕 in src/ui/toolbar/toolbar.ts（擴充）
- [ ] T081 [US9] 在 App 中整合自動儲存（語義樹變更 → debounce 500ms → save to localStorage）in src/ui/app.ts（擴充）

**Checkpoint**: 持久化和匯出匯入完整運作。SC-009 達成。

---

## Phase 10: User Story 7 - 註解保留與雙向同步 (Priority: P3)

**Goal**: 程式碼註解在轉換為積木後不丟失，拖拉時跟隨所屬積木

**Independent Test**: 貼入含各種註解的程式碼，round-trip 後所有註解位置和內容正確

### 測試

- [ ] T082 [P] [US7] 撰寫註解 round-trip 整合測試（行尾註解、獨立註解、表達式內部註解）in tests/integration/comment-roundtrip.test.ts

### 實作

- [ ] T083 [US7] 擴充 lifter 處理 tree-sitter 的 comment 節點（行尾 → Annotation inline，獨立 → comment SemanticNode，表達式內 → Annotation before/after）in src/core/lift/lifter.ts（擴充）
- [ ] T084 [US7] 擴充 code-generator 還原 Annotation 為程式碼註解（inline → 行尾 //，獨立 → 獨立行 //）in src/core/projection/code-generator.ts（擴充）
- [ ] T085 [US7] 擴充 block-renderer 顯示註解（Annotation → Blockly block comment，獨立 comment → 註解積木）in src/core/projection/block-renderer.ts（擴充）

**Checkpoint**: 註解在雙向轉換中完整保留。

---

## Phase 11: User Story 8 - 概念代數三層分層與映射 (Priority: P3)

**Goal**: 概念正確分層，具體概念可查到抽象概念，降級機制運作正常

**Independent Test**: 查詢 cpp:vector_push_back 回傳 container_add；L2 概念在 L0 環境降級為 func_call

### 測試

- [ ] T086 [P] [US8] 撰寫概念代數整合測試（三層查詢 + abstractConcept 映射 + 降級驗證）in tests/integration/concept-algebra.test.ts

### 實作

- [ ] T087 [US8] 擴充 ConceptDef 加入 semanticContract（effect, returnSemantics, chainable）in src/core/types.ts（擴充）
- [ ] T088 [US8] 在 C++ 積木 JSON 中為所有 Lang-Library 概念標註 abstractConcept 映射 in src/languages/cpp/blocks/stdlib/*.json（擴充）
- [ ] T089 [US8] 實作 ConceptRegistry.findAbstract 和 listByLayer 的完整查詢鏈 in src/core/concept-registry.ts（擴充）

**Checkpoint**: 概念代數基礎架構完整，可支援未來的跨語言轉換。

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: 全面整合測試、效能驗證、清理

- [ ] T090 [P] 端對端 round-trip 測試（所有 Universal + C++ 積木，覆蓋 SC-001）in tests/integration/full-roundtrip.test.ts
- [ ] T091 [P] Edge case 測試（空程式碼、20+ 層巢狀、超長行、語法錯誤部分同步）in tests/integration/edge-cases.test.ts
- [ ] T092 效能驗證（同步延遲 ≤300ms/500ms、投影切換 ≤200ms，覆蓋 SC-004/SC-007/SC-008）in tests/integration/performance.test.ts
- [ ] T093 實作底部狀態列（顯示當前 Language/Style/Level/同步狀態）in src/ui/layout/status-bar.ts
- [ ] T094 實作 console-panel（程式輸出顯示，整合既有 interpreter）in src/ui/panels/console-panel.ts
- [ ] T095 [P] 實作 variable-panel（runtime 變數檢視，整合既有 interpreter）in src/ui/panels/variable-panel.ts
- [ ] T096 清理舊程式碼（移除不再使用的 src/core/converter.ts、src/core/code-to-blocks.ts、src/ui/code-editor.ts 等舊模組）
- [ ] T097 執行 quickstart.md 驗證流程（新增 JSON 積木 → 重新載入 → 確認工具箱出現 → round-trip 正確）
- [ ] T098 最終 npm test 全部通過 + npm run build 成功

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 無依賴，立即開始
- **Phase 2 (Foundational)**: 依賴 Phase 1 完成 — **阻擋所有 User Story**
- **Phase 3 (US1)**: 依賴 Phase 2
- **Phase 4 (US2)**: 依賴 Phase 3（需要 code-generator + UI 面板）
- **Phase 5 (US3)**: 依賴 Phase 4（需要 lifter 基礎）
- **Phase 6 (US4)**: 依賴 Phase 2 + Phase 3（需要工具箱 + block-renderer）
- **Phase 7 (US5)**: 依賴 Phase 3 + Phase 4（需要 code-generator + lifter）
- **Phase 8 (US6)**: 依賴 Phase 2（需要 BlockSpecRegistry）
- **Phase 9 (US9)**: 依賴 Phase 3（需要語義樹 + UI）
- **Phase 10 (US7)**: 依賴 Phase 4（需要 lifter + code-generator）
- **Phase 11 (US8)**: 依賴 Phase 2（需要 ConceptRegistry）
- **Phase 12 (Polish)**: 依賴所有前置 Phase

### User Story Dependencies

```
Phase 2 (Foundational)
  ├─→ Phase 3 (US1: 積木→程式碼) ──→ Phase 4 (US2: 程式碼→積木) ──→ Phase 5 (US3: 四級 lift)
  │                                                                      │
  │                                                                      └──→ Phase 10 (US7: 註解)
  │
  ├─→ Phase 6 (US4: 漸進揭露)     [可與 US2/US3 平行]
  ├─→ Phase 7 (US5: 參數化投影)   [需 US1+US2 完成]
  ├─→ Phase 8 (US6: JSON 擴充)   [可與 US1 平行]
  ├─→ Phase 9 (US9: 持久化)      [需 US1 完成]
  └─→ Phase 11 (US8: 概念代數)    [可與 US1 平行]
```

### Parallel Opportunities

Phase 2 完成後，以下可平行開發：
- **Group A**: US1 → US2 → US3 → US7（主要管線，循序）
- **Group B**: US6 + US8 + US11（概念層，可獨立於 UI）
- **Group C**: US4（漸進揭露，需 US1 的 block-renderer）
- **Group D**: US5（參數化投影，需 US1+US2）
- **Group E**: US9（持久化，需 US1）

---

## Parallel Example: Phase 2 (Foundational)

```bash
# 三個測試可同時撰寫（不同檔案）：
T005: tests/unit/core/semantic-tree.test.ts
T006: tests/unit/core/concept-registry.test.ts
T007: tests/unit/core/block-spec-registry.test.ts

# JSON 遷移可同時進行：
T013: src/languages/cpp/blocks/core.json
T014: src/languages/cpp/blocks/stdlib/io.json
T015: src/i18n/zh-TW/blocks.json + src/i18n/en/blocks.json
```

## Parallel Example: Phase 7 (US5)

```bash
# Style preset JSON 可同時建立：
T061: src/languages/cpp/styles/apcs.json
T062: src/languages/cpp/styles/competitive.json
T063: src/languages/cpp/styles/google.json

# Toolbar selectors 可同時實作：
T067: src/ui/toolbar/locale-selector.ts
T068: src/ui/toolbar/language-selector.ts
```

---

## Implementation Strategy

### MVP First (Phase 1~3: US1 Only)

1. 完成 Phase 1: Setup
2. 完成 Phase 2: Foundational
3. 完成 Phase 3: US1（積木→程式碼）
4. **STOP and VALIDATE**: 拖拉積木，程式碼面板即時更新
5. 這就是最小可行產品

### Incremental Delivery

1. Setup + Foundational → 基礎就緒
2. + US1 → 積木→程式碼單向同步 → **Demo #1**
3. + US2 → 雙向同步完整 → **Demo #2**
4. + US3 → 四級 lift 降級 → 穩健性大幅提升
5. + US4/US5 → 參數化投影 + 漸進揭露 → **Demo #3**
6. + US6/US8/US9 → 擴充性 + 持久化 → **Demo #4**
7. + US7 → 註解保留 → 功能完整
8. Polish → 效能、edge case、清理 → **Release**

---

## Notes

- 憲法要求 TDD：每個 Story 的測試 MUST 先寫且 FAIL，再實作使其通過
- 每個 Phase 完成後 MUST commit
- [P] 任務 = 不同檔案，無依賴，可平行
- [USn] 標籤 = 對應 spec.md 的 User Story n
- 總計 98 個任務，12 個 Phase
