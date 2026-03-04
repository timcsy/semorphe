# Tasks: 積木系統 UX 深度改善（第二波）

**Input**: Design documents from `/specs/004-deep-ux-improve/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Tests**: 依 Constitution 要求遵循 TDD 流程（Red → Green → Refactor）

**Organization**: 任務依 User Story 分群，每個 Story 可獨立實作及測試。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可平行執行（不同檔案、無相依）
- **[Story]**: 所屬 User Story（US1~US6）
- 含精確檔案路徑

---

## Phase 1: Setup

**Purpose**: 新增共用型別與 HTML 結構

- [x] T001 在 src/core/types.ts 新增 ToolboxLevel 型別（'beginner' | 'advanced'）及 BEGINNER_BLOCKS 常數陣列（18 個積木 ID）、QUICK_ACCESS_ITEMS 常數陣列（6 個快捷項目定義）、DEFAULT_TEMPLATE_STATE 常數（C++ iostream 骨架 JSON）
- [x] T002 在 index.html 新增 UI 元素：toolbar 內的「清空」按鈕、「初級/進階」模式切換按鈕、blockly-panel 上方的快捷列容器 div#quick-access-bar

---

## Phase 2: Foundational

**Purpose**: 擴充 BlockRegistry 以支援工具箱分級過濾

**⚠️ CRITICAL**: US2 依賴此階段的 toToolboxDef 過濾能力

### 測試（Red Phase）

- [x] T003 在 tests/unit/block-registry.test.ts 新增 toToolboxDef 過濾測試：驗證 level='beginner' 時只回傳 BEGINNER_BLOCKS 中的積木、level='advanced' 回傳全部積木、beginner 模式的分類數 ≤ 6

### 實作（Green Phase）

- [x] T004 修改 src/core/block-registry.ts 的 toToolboxDef() 方法，新增可選參數 level?: ToolboxLevel，當 level='beginner' 時只包含 BEGINNER_BLOCKS 清單中的積木 ID

**Checkpoint**: 基礎設施就緒，可開始各 User Story 實作

---

## Phase 3: User Story 1 - 預設程式骨架 (Priority: P1) 🎯 MVP

**Goal**: 首次開啟自動載入 C++ iostream 骨架，並提供清空按鈕

**Independent Test**: 清除 localStorage 後開啟頁面，驗證 workspace 包含完整骨架積木且產出合法 C++ 程式碼

### 測試（Red Phase）

- [x] T005 [P] [US1] 在 tests/integration/ux-features.test.ts 建立 US1 測試：(1) 無 localStorage 時 restoreState 後 workspace 包含 c_include/c_using_namespace/u_func_def/u_return 積木 (2) 有 localStorage 時載入儲存狀態而非模板 (3) 清空功能移除所有積木

### 實作（Green Phase）

- [x] T006 [US1] 修改 src/ui/App.ts 的 restoreState()：若 storage.load() 回傳 null，使用 DEFAULT_TEMPLATE_STATE 載入預設骨架模板到 blocklyEditor
- [x] T007 [US1] 修改 src/ui/App.ts 新增 setupClearButton()：綁定 index.html 的清空按鈕，呼叫 blocklyEditor.clear() 清空 workspace 所有積木
- [x] T008 [US1] 驗證 T005 測試全部通過，確認 DEFAULT_TEMPLATE_STATE 的骨架積木序列化格式正確（c_include→c_using_namespace→u_func_def+u_return 巢狀結構）

**Checkpoint**: 首次開啟即有完整 C++ 骨架，清空按鈕正常運作

---

## Phase 4: User Story 2 - 工具箱分級顯示 (Priority: P1)

**Goal**: 工具箱支援初級/進階模式切換，初級模式只顯示 18 個常用積木

**Independent Test**: 切換到初級模式驗證只有 18 個積木可見，切換到進階模式驗證全部 67 個積木可見

### 測試（Red Phase）

- [x] T009 [P] [US2] 在 tests/integration/ux-features.test.ts 新增 US2 測試：(1) 初級模式 toolbox 積木數 ≤ 18 且分類 ≤ 6 (2) 進階模式顯示全部積木 (3) 初級模式隱藏 c_printf/c_scanf 但顯示 u_print/u_input (4) 模式持久化至 localStorage

### 實作（Green Phase）

- [x] T010 [US2] 修改 src/ui/storage.ts 新增 saveToolboxLevel(level)/loadToolboxLevel() 方法，使用 localStorage key 'code-blockly-toolbox-level' 持久化 ToolboxLevel
- [x] T011 [US2] 修改 src/ui/App.ts 新增 setupToolboxToggle()：讀取初始 level（從 storage 或預設 'beginner'）、綁定切換按鈕事件、呼叫 blocklyEditor.updateToolbox(registry, languageId, level) 切換工具箱
- [x] T012 [US2] 修改 src/ui/blockly-editor.ts 的 updateToolbox() 方法，接受 level 參數並傳遞給 registry.toToolboxDef(languageId, level)
- [x] T013 [US2] 驗證 T003 + T009 測試全部通過，確認初級模式精確包含 BEGINNER_BLOCKS 清單的 18 個積木

**Checkpoint**: 工具箱初級/進階模式切換正常，持久化正確

---

## Phase 5: User Story 3 - 變數引用自動完成 (Priority: P2)

**Goal**: u_var_ref 改為 dropdown，自動列出已宣告的變數名稱

**Independent Test**: 宣告變數 x 後拖出 u_var_ref，dropdown 包含 x；刪除宣告後 dropdown 不再包含 x

### 測試（Red Phase）

- [x] T014 [P] [US3] 在 tests/integration/ux-features.test.ts 新增 US3 測試：(1) u_var_ref 積木使用 FieldDropdown 而非 FieldTextInput (2) dropdown 列出 workspace 中 u_var_declare 的 NAME 值 (3) dropdown 列出 u_count_loop 的 VAR 值 (4) 無變數時提供預設佔位選項

### 實作（Green Phase）

- [x] T015 [US3] 修改 src/ui/blockly-editor.ts 的 u_var_ref 積木定義：將 field_input NAME 改為 FieldDropdown，使用函式生成器掃描 workspace.getBlocksByType('u_var_declare') 和 getBlocksByType('u_count_loop')，收集 NAME/VAR 欄位值，無變數時提供 [('(自訂)', '__CUSTOM__')]
- [x] T016 [US3] 在 u_var_ref 積木新增「自訂」選項處理：當選擇 '__CUSTOM__' 時允許使用者手動輸入變數名稱（透過額外的 FieldTextInput 或 validator 機制）
- [x] T017 [US3] 驗證 T014 測試全部通過，確認 dropdown 動態更新正常（新增/刪除變數宣告後 dropdown 選項即時反映）

**Checkpoint**: u_var_ref dropdown 正確列出已宣告變數，自訂輸入可用

---

## Phase 6: User Story 4 - 連接型別檢查 (Priority: P2)

**Goal**: Statement 積木不能放入 Expression 插槽，反之亦然

**Independent Test**: 將 u_if 拖入 u_arithmetic 的 A 插槽被拒絕；將 u_number 拖入 u_if 的 BODY 被拒絕

### 測試（Red Phase）

- [x] T018 [P] [US4] 在 tests/integration/ux-features.test.ts 新增 US4 測試：(1) 所有有 previousStatement 的 JSON 積木定義其值為 "Statement" 而非 null (2) 所有有 nextStatement 的 JSON 積木定義其值為 "Statement" 而非 null (3) 所有 input_statement 類型有 check: "Statement" (4) 動態積木的 setPreviousStatement/setNextStatement 使用 "Statement" 參數

### 實作（Green Phase）

- [x] T019 [P] [US4] 修改 src/blocks/universal.json：所有 "previousStatement": null → "previousStatement": "Statement"，所有 "nextStatement": null → "nextStatement": "Statement"，所有 input_statement 新增 "check": "Statement"
- [x] T020 [P] [US4] 修改 src/languages/cpp/blocks/basic.json：同上述 previousStatement/nextStatement/input_statement 的 Statement 型別檢查修改
- [x] T021 [P] [US4] 修改 src/languages/cpp/blocks/advanced.json 和 src/languages/cpp/blocks/special.json：同上述 Statement 型別檢查修改
- [x] T022 [US4] 修改 src/ui/blockly-editor.ts 所有動態積木定義：setPreviousStatement(true, null) → setPreviousStatement(true, 'Statement')、setNextStatement(true, null) → setNextStatement(true, 'Statement')、appendStatementInput('BODY').setCheck('Statement')
- [x] T023 [US4] 驗證 T018 測試全部通過，並確認現有測試套件不受影響（已儲存的 workspace 載入不做型別檢查）

**Checkpoint**: Statement/Expression 型別檢查生效，不相容連接被拒絕

---

## Phase 7: User Story 5 - 常用積木快捷列 (Priority: P3)

**Goal**: workspace 上方顯示快捷按鈕列，點擊直接產生對應積木

**Independent Test**: 點擊「輸出」按鈕，u_print 積木出現在 workspace 可見區域中央

### 測試（Red Phase）

- [x] T024 [P] [US5] 在 tests/integration/ux-features.test.ts 新增 US5 測試：(1) QUICK_ACCESS_ITEMS 包含 6 個項目 (2) 呼叫 createBlockAtCenter(blockType) 在 workspace 中產生正確類型的積木 (3) 連續呼叫兩次相同 blockType 產生兩個不同 ID 的積木且位置不完全重疊

### 實作（Green Phase）

- [x] T025 [US5] 修改 src/ui/blockly-editor.ts 新增 createBlockAtCenter(blockType: string) 方法：使用 Blockly.serialization.blocks.append() 在 workspace 可見區域中央建立積木，累加 offset（30px）避免重疊
- [x] T026 [US5] 修改 src/ui/App.ts 新增 setupQuickAccess()：遍歷 QUICK_ACCESS_ITEMS 生成 HTML 按鈕到 #quick-access-bar 容器，每個按鈕點擊呼叫 blocklyEditor.createBlockAtCenter(item.blockType)
- [x] T027 [US5] 在 src/style.css 新增快捷列樣式：水平排列的按鈕列、hover 效果、適當的間距和大小
- [x] T028 [US5] 驗證 T024 測試全部通過，確認快捷列正確渲染且積木位置計算正常

**Checkpoint**: 快捷列可見且點擊產生積木正常

---

## Phase 8: User Story 6 - 即時錯誤提示 (Priority: P3)

**Goal**: 即時檢查非 void 函式缺 return、未宣告變數，並在積木上顯示警告

**Independent Test**: 建立 int main() 不加 return，驗證警告圖示出現

### 測試（Red Phase）

- [x] T029 [P] [US6] 在 tests/integration/ux-features.test.ts 新增 US6 測試：(1) runDiagnostics() 偵測 u_func_def(RETURN_TYPE='int') 無 u_return 時回傳 missing_return 診斷 (2) 偵測 u_var_ref(NAME='y') 無對應宣告時回傳 undeclared_variable 診斷 (3) u_func_def(RETURN_TYPE='void') 無 return 不回傳警告 (4) 有對應宣告的 u_var_ref 不回傳警告

### 實作（Green Phase）

- [x] T030 [US6] 在 src/ui/blockly-editor.ts 新增 runDiagnostics() 方法：掃描所有 u_func_def 檢查非 void 函式是否有 u_return、掃描所有 u_var_ref 檢查 NAME 是否在 u_var_declare.NAME 或 u_count_loop.VAR 中，回傳 WorkspaceDiagnostic[]
- [x] T031 [US6] 在 src/ui/blockly-editor.ts 新增 applyDiagnostics(diagnostics) 方法：對每個診斷呼叫 block.setWarningText(message, type)、清除已修正積木的警告 setWarningText(null, type)
- [x] T032 [US6] 修改 src/ui/App.ts 新增 workspace change listener：過濾 isUiEvent、300ms debounce 後呼叫 blocklyEditor.runDiagnostics() 並 applyDiagnostics()
- [x] T033 [US6] 驗證 T029 測試全部通過，確認警告即時顯示和清除正常

**Checkpoint**: 即時錯誤提示正常運作，hover 可見錯誤訊息

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: 全面驗證與整合

- [x] T034 執行完整測試套件（npm test），確認所有新增測試 + 現有測試全部通過
- [x] T035 手動依 quickstart.md 的 6 個情境進行端到端驗證，確認所有功能在瀏覽器中正常運作
- [x] T036 執行 npm run lint（若存在），修復任何 lint 錯誤

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 無相依 - 立即開始
- **Foundational (Phase 2)**: 依賴 Phase 1 的型別定義
- **US1 (Phase 3)**: 依賴 Phase 1 的 DEFAULT_TEMPLATE_STATE
- **US2 (Phase 4)**: 依賴 Phase 2 的 toToolboxDef 過濾
- **US3 (Phase 5)**: 依賴 Phase 1（無其他前置）
- **US4 (Phase 6)**: 無前置依賴（只改 JSON 定義和動態積木）
- **US5 (Phase 7)**: 依賴 Phase 1 的 QUICK_ACCESS_ITEMS
- **US6 (Phase 8)**: 無前置依賴
- **Polish (Phase 9)**: 依賴所有 User Story 完成

### User Story Dependencies

- **US1 (P1)**: Phase 1 完成後即可開始
- **US2 (P1)**: Phase 2 完成後即可開始
- **US3 (P2)**: Phase 1 完成後即可開始，與 US1/US2 無相依
- **US4 (P2)**: 無前置依賴，與其他 Story 無相依（但建議在 US1/US2 之後以避免 JSON 衝突）
- **US5 (P3)**: Phase 1 完成後即可開始，與其他 Story 無相依
- **US6 (P3)**: 無前置依賴，與其他 Story 無相依

### Within Each User Story

- 測試 MUST 先寫且 FAIL（Red Phase）
- 實作使測試通過（Green Phase）
- 每個 Story 完成後 commit

### Parallel Opportunities

- T005, T009, T014, T018, T024, T029 的測試可在各自 Phase 開始時平行撰寫
- T019, T020, T021 的 JSON 修改可平行執行（不同檔案）

---

## Parallel Example: User Story 4

```bash
# 平行修改 JSON 檔案（不同檔案無衝突）：
Task T019: "修改 src/blocks/universal.json 的 Statement 型別檢查"
Task T020: "修改 src/languages/cpp/blocks/basic.json 的 Statement 型別檢查"
Task T021: "修改 src/languages/cpp/blocks/advanced.json + special.json 的 Statement 型別檢查"
# 以上三者完成後：
Task T022: "修改 src/ui/blockly-editor.ts 動態積木的型別檢查"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成 Phase 1: Setup
2. 完成 Phase 3: US1（預設骨架 + 清空按鈕）
3. **STOP and VALIDATE**: 測試 US1 獨立運作
4. 若就緒可部署展示

### Incremental Delivery

1. Setup + Foundational → 基礎就緒
2. US1 → 測試 → commit（預設骨架 MVP）
3. US2 → 測試 → commit（工具箱分級）
4. US3 → 測試 → commit（變數 dropdown）
5. US4 → 測試 → commit（型別檢查）
6. US5 → 測試 → commit（快捷列）
7. US6 → 測試 → commit（錯誤提示）
8. Polish → 全面驗證 → commit

---

## Notes

- [P] 標記的任務可平行執行（不同檔案、無相依）
- [Story] 標記對應 spec.md 的 User Story
- 每個 Story 可獨立完成和測試
- 修改 JSON 積木定義時（US4），注意不破壞已存在的 workspace 儲存狀態
- 300ms debounce 用於 US6 的錯誤檢查，避免效能問題
