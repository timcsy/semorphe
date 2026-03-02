# Tasks: 程式碼與 Blockly 積木雙向轉換工具

**Input**: Design documents from `/specs/001-code-blockly-converter/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: TDD 強制（依據 Constitution II）。每個 User Story 的測試 MUST 先寫、先失敗，再實作。

**Organization**: 任務依 User Story 分組，每個 Story 可獨立實作與測試。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可平行執行（不同檔案、無依賴）
- **[Story]**: 所屬 User Story（US1, US2, US3, US4）
- 包含確切的檔案路徑

## Phase 1: Setup

**Purpose**: 專案初始化與基礎結構

- [x] T001 使用 Vite 初始化 TypeScript 專案，安裝依賴（blockly, web-tree-sitter, codemirror, @codemirror/lang-cpp, vitest, happy-dom），建立 src/ 和 tests/ 目錄結構
- [x] T002 設定 Vitest 設定檔（vitest.config.ts），配置 happy-dom 環境
- [x] T003 [P] 設定 tree-sitter WASM 檔案的靜態資源處理（Vite public/ 目錄配置）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 核心型別定義和共用介面，所有 User Story 都依賴此階段

**⚠️ CRITICAL**: 必須完成才能開始任何 User Story

### Tests for Foundational

> **NOTE: 先寫測試，確保失敗後再實作**

- [x] T004 [P] 撰寫 BlockSpec 型別驗證測試 in tests/unit/types.test.ts

### Implementation for Foundational

- [x] T005 定義核心型別（BlockSpec, CodeTemplate, AstPattern, ParserModule, GeneratorModule, Converter, WorkspaceState）in src/core/types.ts
- [x] T006 建立測試用 fixture：範例積木定義 JSON in tests/fixtures/block-specs/sample-for-loop.json
- [x] T007 [P] 建立測試用 fixture：範例 C 程式碼 in tests/fixtures/code-samples/hello-world.c

**Checkpoint**: 核心型別已定義，所有 Story 可以開始

---

## Phase 3: User Story 1 - 定義積木規範並註冊積木 (Priority: P1) 🎯 MVP

**Goal**: 使用者可載入積木定義檔，積木正確出現在 Blockly 工具箱中

**Independent Test**: 載入積木定義 JSON → 驗證 Blockly 工具箱中出現對應積木

### Tests for User Story 1

> **NOTE: 先寫測試，確保失敗後再實作**

- [x] T008 [P] [US1] 撰寫 BlockRegistry 單元測試（register、get、validate、getByNodeType、toToolboxDef）in tests/unit/block-registry.test.ts
- [x] T009 [P] [US1] 撰寫 BlockRegistry 整合測試（載入多份定義檔、ID 衝突偵測、格式錯誤處理）in tests/integration/block-registry-integration.test.ts

### Implementation for User Story 1

- [x] T010 [US1] 實作 BlockRegistry（register, unregister, get, getByNodeType, getByCategory, validate, toToolboxDef）in src/core/block-registry.ts
- [x] T011 [US1] 撰寫預設 C/C++ 基礎積木定義 JSON（變數、運算、條件、迴圈、陣列、函式、scanf/printf）in src/languages/cpp/blocks/basic.json
- [x] T012 [US1] 撰寫預設 C/C++ 進階積木定義 JSON（指標、結構體、字串、cin/cout、STL、class、template）in src/languages/cpp/blocks/advanced.json
- [x] T013 [US1] 撰寫原始碼積木和預處理指令積木定義 JSON in src/languages/cpp/blocks/special.json

**Checkpoint**: BlockRegistry 可載入積木定義、驗證格式、產生工具箱定義

---

## Phase 4: User Story 2 - Blockly 積木轉換為 C/C++ 程式碼 (Priority: P2)

**Goal**: 使用者在 Blockly 中拖拉積木，即時產生可編譯的 C/C++ 程式碼

**Independent Test**: 在 Blockly 中組合 for 迴圈 + printf 積木 → 驗證產出的 C 程式碼語法正確

### Tests for User Story 2

> **NOTE: 先寫測試，確保失敗後再實作**

- [ ] T014 [P] [US2] 撰寫 C/C++ Generator 單元測試（單一積木產生程式碼、巢狀積木、#include 收集、運算子優先順序括號）in tests/unit/cpp-generator.test.ts
- [ ] T015 [P] [US2] 撰寫 Generator 整合測試（完整程式產生、多積木組合、編譯驗證）in tests/integration/cpp-generator.test.ts

### Implementation for User Story 2

- [ ] T016 [US2] 實作 C/C++ Generator Module（依據 codeTemplate 產生程式碼，處理 imports 收集、運算子優先順序）in src/languages/cpp/generator.ts
- [ ] T017 [US2] 實作 Converter 的 blocksToCode 方法 in src/core/converter.ts

**Checkpoint**: Block → Code 方向可正常運作，產出可編譯的 C/C++ 程式碼

---

## Phase 5: User Story 3 - C/C++ 程式碼轉換為 Blockly 積木 (Priority: P3)

**Goal**: 使用者輸入 C/C++ 程式碼，系統解析並產生對應的 Blockly 積木組合

**Independent Test**: 輸入含 if-else 和 for 迴圈的 C 程式碼 → 驗證 Blockly workspace 中產生正確的積木結構

### Tests for User Story 3

> **NOTE: 先寫測試，確保失敗後再實作**

- [ ] T018 [P] [US3] 撰寫 C/C++ Parser 單元測試（解析簡單程式碼回傳 CST、tree-sitter 初始化）in tests/unit/cpp-parser.test.ts
- [ ] T019 [P] [US3] 撰寫 Code → Block 整合測試（CST 映射為 Blockly workspace JSON、未知語法降級為原始碼積木、深入解析策略）in tests/integration/code-to-blocks.test.ts
- [ ] T020 [P] [US3] 撰寫 Roundtrip 測試（Code → Block → Code 語意等價性驗證）in tests/integration/roundtrip.test.ts

### Implementation for User Story 3

- [ ] T021 [US3] 實作 C/C++ Parser Module（初始化 web-tree-sitter WASM、載入 C/C++ grammar、parse 方法）in src/languages/cpp/parser.ts
- [ ] T022 [US3] 實作 Converter 的 codeToBlocks 方法（AST 走訪、依 astPattern 匹配積木、未知節點降級為原始碼積木）in src/core/converter.ts
- [ ] T023 [US3] 實作 AST 節點到 Blockly workspace JSON 的映射邏輯（處理巢狀結構、expression vs statement）in src/core/converter.ts

**Checkpoint**: Code → Block 方向可正常運作，包含原始碼積木降級機制

---

## Phase 6: User Story 4 - Web UI 雙向同步編輯 (Priority: P4)

**Goal**: 左右分割畫面，Blockly 編輯器和程式碼編輯器雙向即時同步，含持久化

**Independent Test**: 在積木面板修改 → 程式碼面板更新；在程式碼面板修改 → 積木面板更新；關閉重開後自動恢復

### Tests for User Story 4

> **NOTE: 先寫測試，確保失敗後再實作**

- [ ] T024 [P] [US4] 撰寫 SyncController 單元測試（Block→Code 觸發、Code→Block 觸發、防抖邏輯、防止無限迴圈）in tests/unit/sync-controller.test.ts
- [ ] T025 [P] [US4] 撰寫 Storage 單元測試（localStorage 存取、匯出 JSON 檔案、匯入 JSON 檔案）in tests/unit/storage.test.ts
- [ ] T026 [P] [US4] 撰寫整合測試（雙向同步端到端流程、自訂積木上傳、工作內容恢復）in tests/integration/sync.test.ts

### Implementation for User Story 4

- [ ] T027 [US4] 實作 Blockly 編輯器封裝（初始化 workspace、事件監聽、動態工具箱更新）in src/ui/blockly-editor.ts
- [ ] T028 [US4] 實作 CodeMirror 編輯器封裝（初始化、C/C++ 語法高亮、變更事件監聽）in src/ui/code-editor.ts
- [ ] T029 [US4] 實作 SyncController（雙向同步協調、防抖延遲、防止無限迴圈、來源鎖定）in src/ui/sync-controller.ts
- [ ] T030 [US4] 實作 Storage 模組（localStorage 自動儲存/恢復、匯出下載 JSON、匯入上傳 JSON、自訂積木持久化）in src/ui/storage.ts
- [ ] T031 [US4] 實作主應用程式（左右分割佈局、初始化所有模組、自訂積木上傳 UI）in src/ui/App.ts
- [ ] T032 [US4] 建立 HTML 入口頁面和 CSS 佈局 in src/index.html 和 src/style.css
- [ ] T033 [US4] 實作 main.ts 進入點（初始化 tree-sitter WASM、載入預設積木、啟動應用）in src/main.ts

**Checkpoint**: 完整的 Web 應用，雙向同步正常，含持久化和匯出匯入

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 品質確認與最終驗證

- [ ] T034 執行 quickstart.md 驗證（按照快速開始文件操作，確認流程正確）
- [ ] T035 效能驗證（Block→Code < 1s, Code→Block < 2s）
- [ ] T036 移除 Vite 腳手架產生的未使用樣板程式碼

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 無依賴 — 立即開始
- **Foundational (Phase 2)**: 依賴 Phase 1 — 阻擋所有 User Story
- **US1 (Phase 3)**: 依賴 Phase 2 — 無其他 Story 依賴
- **US2 (Phase 4)**: 依賴 Phase 3（需要 BlockRegistry 和積木定義 JSON）
- **US3 (Phase 5)**: 依賴 Phase 3（需要 BlockRegistry 和積木定義 JSON）
- **US4 (Phase 6)**: 依賴 Phase 4 和 Phase 5（需要 Generator 和 Parser）
- **Polish (Phase 7)**: 依賴所有 User Story 完成

### Within Each User Story

- 測試 MUST 先寫且確認失敗（Red）
- 實作讓測試通過（Green）
- 重構（Refactor）
- 完成後 commit

### Parallel Opportunities

- T003 與 T002 可平行
- T004 與 T006, T007 可平行
- T008, T009 可平行（US1 測試）
- T011, T012, T013 可平行（積木定義 JSON）
- T014, T015 可平行（US2 測試）
- T018, T019, T020 可平行（US3 測試）
- T024, T025, T026 可平行（US4 測試）
- T027, T028 可平行（編輯器封裝）

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成 Phase 1: Setup
2. 完成 Phase 2: Foundational
3. 完成 Phase 3: User Story 1
4. **驗證**: BlockRegistry 可載入積木定義、驗證格式、產生工具箱

### Incremental Delivery

1. Setup + Foundational → 基礎就緒
2. US1（積木規範）→ MVP
3. US2（Block→Code）→ 可從積木產生程式碼
4. US3（Code→Block）→ 可從程式碼產生積木
5. US4（Web UI）→ 完整應用

---

## Notes

- [P] tasks = 不同檔案、無依賴
- [Story] label 對應 spec.md 中的 User Story
- 每個 User Story 可獨立完成和測試
- 先確認測試失敗再實作（TDD）
- 每完成一個 task 或一組相關 task 後 commit
- 套用 Vite 腳手架時注意不要覆蓋 specs/ 和 .specify/ 目錄
