# Tasks: 積木系統認知負荷改善

**Input**: Design documents from `/specs/003-polish-block-ux/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Tests**: 依 Constitution 原則 II（測試驅動開發），每個 User Story 的測試 MUST 在實作前撰寫。

**Organization**: 按 User Story 分組，每個 Story 可獨立實作與驗證。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可與同 phase 其他 [P] 任務並行（不同檔案、無依賴）
- **[Story]**: 所屬 User Story（US1, US2, US3, US4, US5）

---

## Phase 1: Setup

**Purpose**: 確認現有測試基線，確保修改前一切正常

- [x] T001 執行現有測試套件確認基線通過：`npm test`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: localStorage 歸零邏輯——所有 User Story 都依賴此功能，因為刪除積木後舊 workspace 會無法載入

**⚠️ CRITICAL**: 此 phase 必須先完成，否則刪除積木後瀏覽器會報錯

- [x] T002 撰寫 localStorage 歸零邏輯的測試：當 workspace 含有未註冊的 block type 時，載入應清除舊資料並回傳空 workspace。在 tests/integration/sync.test.ts 中新增測試案例
- [x] T003 在 src/ui/App.ts 實作 localStorage 歸零邏輯：loadState() 中用 try-catch 包裹 Blockly.serialization.workspaces.load()，捕獲到未註冊 block type 錯誤時呼叫 localStorage.removeItem() 並使用空 workspace

**Checkpoint**: Foundational 完成，可開始 User Story 實作

---

## Phase 3: User Story 1 — 清爽的工具箱（減少選擇困難）(Priority: P1) 🎯 MVP

**Goal**: 從系統中完全刪除 8 個重複的 C++ 積木定義，工具箱積木數量降至 ≤ 35 個

**Independent Test**: 載入 registry 後，驗證已刪積木不存在、工具箱計數 ≤ 35、code-to-blocks 轉換仍正常

### Tests for US1

- [x] T004 [US1] 撰寫積木刪除驗證測試：在 tests/unit/block-registry.test.ts 中新增測試，驗證 c_number、c_variable_ref、c_string_literal、c_binary_op、cpp_cout、cpp_cin、cpp_endl、c_var_declare_init_expr 不存在於 registry 中
- [x] T005 [US1] 撰寫工具箱計數測試：在 tests/integration/block-registry-integration.test.ts 中新增測試，驗證刪除 8 個積木後工具箱計數正確（67 = 75 - 8）
- [x] T006 [US1] 撰寫 code-to-blocks 降級測試：在 tests/integration/code-to-blocks.test.ts 中驗證原本會映射到已刪積木的 C++ 語法（如數字字面量、cout、cin）仍能正確轉換為對應的通用積木（u_number、u_print、u_input）

### Implementation for US1

- [x] T007 [P] [US1] 從 src/languages/cpp/blocks/basic.json 刪除 c_number、c_variable_ref、c_binary_op、c_var_declare_init_expr 四個積木定義
- [x] T008 [P] [US1] 從 src/languages/cpp/blocks/advanced.json 刪除 c_string_literal、cpp_cout、cpp_cin、cpp_endl 四個積木定義
- [x] T009 [US1] 更新引用已刪積木的現有測試：修正 tests/integration/cpp-generator.test.ts 中 c_var_declare_init_expr、cpp_cout、c_number 引用
- [x] T010 [US1] 執行全部測試驗證 US1 完成：`npm test`，217 tests passed

**Checkpoint**: 工具箱已清理，重複積木已移除，code-to-blocks 轉換仍正常

---

## Phase 4: User Story 2 — 積木文字一看就懂（自然語言標籤）(Priority: P2)

**Goal**: 所有共用積木的運算符顯示自然語言標籤；計數迴圈採用包含端點語意

**Independent Test**: 檢查 u_compare、u_arithmetic、u_array_access 的 JSON 定義中 dropdown 選項和 message 文字；執行 u_count_loop 的生成和解析測試

### Tests for US2

- [x] T011 [P] [US2] 撰寫自然語言標籤測試：在 tests/unit/block-registry.test.ts 中驗證 u_compare 的 dropdown 選項為「大於」「小於」等；u_arithmetic 的乘除餘數選項為「×」「÷」「餘數」；u_array_access 的 message0 包含 `[ %2 ]` 而非「的第」
- [x] T012 [P] [US2] 撰寫計數迴圈包含端點測試：在 tests/integration/cpp-adapter.test.ts 中驗證解析 `for (int i = 0; i <= 9; i++)` 能正確匹配和提取 TO

### Implementation for US2

- [x] T013 [P] [US2] 更新 src/blocks/universal.json 中 u_compare 的 dropdown 選項為自然語言標籤
- [x] T014 [P] [US2] 更新 src/blocks/universal.json 中 u_arithmetic 的 dropdown 選項為 ×÷餘數
- [x] T015 [P] [US2] 更新 src/blocks/universal.json 中 u_array_access 的 message0 為 bracket notation
- [x] T016 [US2] 更新 src/languages/cpp/adapter.ts 中 u_count_loop 程式碼生成：`<` → `<=`
- [x] T017 [US2] isCountingFor() 已原生支援 `<=`（COMPARE_OPS 已包含），無需修改
- [x] T018 [US2] 更新 cpp-generator.test.ts 中 u_count_loop 測試預期值為 `<=`
- [x] T019 [US2] 執行全部測試驗證 US2 完成：`npm test`，222 tests passed

**Checkpoint**: 所有積木標籤使用自然語言，計數迴圈「到」語意正確

---

## Phase 5: User Story 3 — 函式參數結構化（不打原始碼）(Priority: P3)

**Goal**: u_func_def 和 u_func_call 改為動態積木，支援加減按鈕增減參數/引數

**Independent Test**: 建立 2 參數的 u_func_def 和 u_func_call，驗證不需輸入任何語法，且生成正確的 `int add(int a, int b)` 程式碼

### Tests for US3

- [x] T020 [P] [US3] 撰寫 u_func_def 動態積木測試：0 params 和 2 params 的程式碼生成
- [x] T021 [P] [US3] 撰寫 u_func_call 動態積木測試：0 args 和 2 args 的程式碼生成
- [x] T022 [P] [US3] 撰寫 code-to-blocks 函式提取測試：動態 TYPE_N/PARAM_N 和 ARG_N 提取

### Implementation for US3

- [x] T023 [US3] 在 src/ui/blockly-editor.ts 中定義 u_func_def 動態積木（plus_/minus_ 增減參數行），保留 universal.json spec 供 registry 使用
- [x] T024 [US3] 在 src/ui/blockly-editor.ts 中定義 u_func_call 動態積木（plus_/minus_ 增減引數 value_input）
- [x] T025 [US3] 更新 adapter.ts generateCode：動態遍歷 TYPE_N/PARAM_N 和 ARG_N，含 fallback 向後相容
- [x] T026 [US3] 更新 adapter.ts extractFields：extractFuncDef 輸出 TYPE_N/PARAM_N；extractFuncCall 輸出 ARG_N value inputs
- [x] T027 [US3] 現有測試使用 PARAMS:'' 格式，因 fallback 機制無需修改
- [x] T028 [US3] 執行全部測試驗證 US3 完成：`npm test`，228 tests passed

**Checkpoint**: 函式定義和呼叫積木支援結構化參數，不需輸入語法

---

## Phase 6: User Story 4 — 變數宣告更靈活 (Priority: P4)

**Goal**: u_var_declare 支援透過 Dropdown 切換有/無初始值模式

**Independent Test**: 拖出 u_var_declare，切換 Dropdown 後驗證 `=` 插槽正確顯示/隱藏，生成 `int x;` 或 `int x = 5;`

### Tests for US4

- [x] T029 [P] [US4] 撰寫 u_var_declare 模式切換測試：INIT_MODE=no_init → `int x;`，INIT_MODE=with_init → `int x = 5;`
- [x] T030 [P] [US4] 撰寫 code-to-blocks 變數宣告提取測試：解析 `int x;` 和 `int x = 5;` 的 INIT_MODE 提取

### Implementation for US4

- [x] T031 [US4] 在 blockly-editor.ts 定義 u_var_declare 動態積木（INIT_MODE dropdown 控制初始值 input），保留 universal.json spec
- [x] T032 [US4] adapter.ts generateCode 已處理有/無 INIT input，向後相容 INIT_MODE
- [x] T033 [US4] 更新 extractVarDeclare 輸出 INIT_MODE=with_init/no_init
- [x] T034 [US4] 現有測試因 fallback 機制無需修改
- [x] T035 [US4] 執行全部測試驗證 US4 完成：`npm test`，231 tests passed

**Checkpoint**: 變數宣告積木可在有/無初始值模式間切換

---

## Phase 7: User Story 5 — 多變數輸入 (Priority: P5)

**Goal**: u_input 改為動態積木，支援加減按鈕增減變數名稱欄位，生成 `cin >> a >> b >> c;`

**Independent Test**: 建立 3 變數的 u_input，驗證生成 `cin >> a >> b >> c;`；解析相同語法回到 3 變數的積木

### Tests for US5

- [x] T036 [P] [US5] 撰寫 u_input 動態積木測試：在 tests/integration/cpp-generator.test.ts 中測試 u_input 帶 1、3 個變數的程式碼生成（cin >> NAME_0 >> NAME_1 >> NAME_2）
- [x] T037 [P] [US5] 撰寫 code-to-blocks 多變數輸入提取測試：在 tests/integration/cpp-adapter.test.ts 中測試解析 `cin >> a >> b >> c;` 能提取為 u_input 的 NAME_0=a, NAME_1=b, NAME_2=c

### Implementation for US5

- [x] T038 [US5] 在 src/ui/blockly-editor.ts 中定義 u_input 動態積木（plus_/minus_ 增減 NAME_N field），保留 universal.json spec 供 registry 使用
- [x] T039 [US5] 更新 src/languages/cpp/adapter.ts 中 u_input 的 generateCode：遍歷 NAME_0..NAME_N 動態 field_input 生成 `cin >> a >> b >> c;`，含 fallback 向後相容 NAME
- [x] T040 [US5] 更新 src/languages/cpp/adapter.ts 中 u_input 的 extractFields：解析 `cin >> a >> b >> c` 提取多個變數為 NAME_N field
- [x] T041 [US5] 現有測試因 fallback 機制（NAME → NAME_N）無需修改
- [x] T042 [US5] 執行全部測試驗證 US5 完成：`npm test`，235 tests passed

**Checkpoint**: 讀取輸入積木支援多變數

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 跨 Story 整合驗證和最終確認

- [x] T043 執行完整測試套件確認無跨 Story 回歸：`npm test`，235 tests passed（專案無 lint script）
- [x] T044 驗證所有 Success Criteria：SC-001（67 積木，移除 8 個重複）、SC-002（自然語言標籤）、SC-003（函式 +/- 動態參數）、SC-004（235 tests passed）、SC-005（<= 包含端點）、SC-006（雙向轉換含 fallback）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 無依賴——立即開始
- **Foundational (Phase 2)**: 依賴 Phase 1——BLOCKS 所有 User Story
- **US1 (Phase 3)**: 依賴 Phase 2——必須先有歸零邏輯才能刪除積木
- **US2 (Phase 4)**: 依賴 Phase 3——標籤修改需在刪除積木後進行（避免修改即將刪除的積木）
- **US3 (Phase 5)**: 依賴 Phase 4——動態積木修改 blockly-editor.ts 和 adapter.ts，需在標籤穩定後進行
- **US4 (Phase 6)**: 依賴 Phase 5——同樣修改 blockly-editor.ts 和 adapter.ts
- **US5 (Phase 7)**: 依賴 Phase 6——同樣修改 blockly-editor.ts 和 adapter.ts
- **Polish (Phase 8)**: 依賴所有 User Story 完成

### User Story Dependencies

- **US1 (P1)**: 無 Story 依賴，但依賴 Foundational
- **US2 (P2)**: 依賴 US1（避免修改即將刪除的積木）
- **US3 (P3)**: 邏輯上獨立，但因共用 blockly-editor.ts 和 adapter.ts 而建議在 US2 後執行
- **US4 (P4)**: 邏輯上獨立，但因共用檔案而建議在 US3 後執行
- **US5 (P5)**: 邏輯上獨立，但因共用檔案而建議在 US4 後執行

### Within Each User Story

- 測試 MUST 先寫且確認失敗（Red）
- 實作後確認測試通過（Green）
- 每個 Story 完成後執行全部測試

### Parallel Opportunities

- Phase 3: T007 和 T008 可並行（不同 JSON 檔案）
- Phase 4: T011 和 T012 可並行（不同測試檔案）；T013、T014、T015 可並行（同一 JSON 的不同積木）
- Phase 5: T020、T021、T022 可並行（不同測試）
- Phase 6: T029 和 T030 可並行（不同測試檔案）
- Phase 7: T036 和 T037 可並行（不同測試檔案）

---

## Implementation Strategy

### MVP First (US1 Only)

1. 完成 Phase 1: Setup
2. 完成 Phase 2: Foundational（localStorage 歸零）
3. 完成 Phase 3: US1（刪除 8 個積木）
4. **STOP and VALIDATE**: 工具箱 ≤ 35 積木，code-to-blocks 正常
5. 可部署 MVP

### Incremental Delivery

1. Setup + Foundational → 基礎就緒
2. US1 → 工具箱清理 → 驗證部署（MVP）
3. US2 → 自然語言標籤 + 包含端點 → 驗證部署
4. US3 → 函式參數結構化 → 驗證部署
5. US4 → 變數宣告靈活 → 驗證部署
6. US5 → 多變數輸入 → 驗證部署
7. Polish → 最終整合驗證

---

## Notes

- [P] 任務 = 不同檔案、無依賴，可並行
- [Story] 標籤追溯任務到對應 User Story
- 依 Constitution 原則 II，每個 Story 嚴格遵循 TDD：Red → Green → Refactor
- 依 Constitution 原則 III，每個 Story 完成後 commit
- 每個 Checkpoint 可獨立驗證該 Story 的 Acceptance Scenarios
