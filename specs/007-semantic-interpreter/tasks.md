# 任務清單：Semantic Model Interpreter — 前端程式執行引擎

**輸入**: 設計文件 `/specs/007-semantic-interpreter/`
**前置條件**: plan.md、spec.md、research.md、data-model.md、quickstart.md

**測試**: 遵循憲法第 II 條 TDD 原則，所有測試在實作前撰寫。

**組織**: 任務按使用者故事分組，每個故事可獨立實作和測試。

## 格式：`[ID] [P?] [Story] 描述`

- **[P]**: 可平行執行（不同檔案，無依賴）
- **[Story]**: 所屬使用者故事（US1、US2、US3、US4）
- 描述包含完整檔案路徑

---

## Phase 1: Setup（基礎建設）

**目的**: 建立目錄結構、型別定義、i18n key

- [X] T001 建立 src/interpreter/ 目錄結構（types.ts、errors.ts、scope.ts、io.ts、interpreter.ts）
- [X] T002 [P] 定義 RuntimeValue、RuntimeType、ExecutionState、FunctionDef、CallFrame、IOState 型別在 src/interpreter/types.ts
- [X] T003 [P] 定義 RuntimeError 類別（含 i18n key 和插值參數）在 src/interpreter/errors.ts
- [X] T004 [P] 新增執行期錯誤和執行 UI 的 i18n key 到 src/i18n/zh-TW/blocks.json 和 src/i18n/en/blocks.json（RUNTIME_ERR_*、EXEC_*）

---

## Phase 2: Foundational（基礎模組 — 所有故事的前置條件）

**目的**: 實作 Scope 和 IOSystem 核心模組，所有使用者故事都依賴這兩個模組

**⚠️ 關鍵**: 此階段必須完成後才能開始任何使用者故事

### 測試先行

- [ ] T005 [P] 撰寫 Scope 單元測試在 tests/unit/scope.test.ts（declare、get、set、parent chain、重複宣告錯誤、未宣告變數錯誤）
- [ ] T006 [P] 撰寫 IOSystem 單元測試在 tests/unit/io.test.ts（stdout 寫入、stdin 佇列讀取、佇列耗盡狀態、reset）

### 實作

- [ ] T007 實作 Scope 類別在 src/interpreter/scope.ts（get、set、declare、createChild、getAll）
- [ ] T008 實作 IOSystem 類別在 src/interpreter/io.ts（write、read、hasInput、reset、getOutput）

**檢查點**: Scope 和 IOSystem 測試全部通過

---

## Phase 3: User Story 1 — 執行程式並查看輸出 (P1) 🎯 MVP

**目標**: 使用者按下「執行」後，程式在瀏覽器中執行，輸出結果顯示在 console 面板

**獨立測試**: 用 print + 數字積木建立簡單程式，按執行，驗證輸出出現在 console 面板

### 測試先行

- [ ] T009 [P] [US1] 撰寫直譯器核心測試在 tests/unit/interpreter.test.ts — 基礎概念：program、number_literal、string_literal、var_declare、var_assign、var_ref、print、endl
- [ ] T010 [P] [US1] 撰寫直譯器核心測試在 tests/unit/interpreter.test.ts — 運算概念：arithmetic（+−×÷%、整數截斷）、compare（< > <= >= == !=）、logic（&& || !）、logic_not
- [ ] T011 [P] [US1] 撰寫直譯器核心測試在 tests/unit/interpreter.test.ts — 流程控制：if（含 else_body）、count_loop、while_loop、break、continue
- [ ] T012 [P] [US1] 撰寫直譯器核心測試在 tests/unit/interpreter.test.ts — 函式：func_def、func_call、return、遞迴（factorial）、巢狀呼叫
- [ ] T013 [P] [US1] 撰寫直譯器核心測試在 tests/unit/interpreter.test.ts — 陣列：array_declare、array_access
- [ ] T014 [P] [US1] 撰寫直譯器核心測試在 tests/unit/interpreter.test.ts — 邊界情況：空程式、未宣告變數錯誤、除以零、步數超限、語言特有概念 skip

### 實作 — 直譯器核心

- [ ] T015 [US1] 實作 SemanticInterpreter 類別骨架在 src/interpreter/interpreter.ts（execute、executeNode、reset、getState）
- [ ] T016 [US1] 實作基礎概念解釋在 src/interpreter/interpreter.ts — program、number_literal、string_literal、var_declare、var_assign、var_ref
- [ ] T017 [US1] 實作運算概念解釋在 src/interpreter/interpreter.ts — arithmetic、compare、logic、logic_not（含型別轉換和整數截斷）
- [ ] T018 [US1] 實作流程控制概念解釋在 src/interpreter/interpreter.ts — if（含 else_body）、count_loop、while_loop、break、continue
- [ ] T019 [US1] 實作函式概念解釋在 src/interpreter/interpreter.ts — func_def、func_call、return（含遞迴支援和 CallFrame 管理）
- [ ] T020 [US1] 實作 I/O 和陣列概念解釋在 src/interpreter/interpreter.ts — print、endl、array_declare、array_access
- [ ] T021 [US1] 實作步數限制和語言特有概念 skip 在 src/interpreter/interpreter.ts

### 實作 — UI 整合

- [ ] T022 [US1] 實作 ConsolePanel 類別在 src/ui/console-panel.ts（appendOutput、clear、setStatus、getElement）
- [ ] T023 [US1] 新增 console 面板和執行狀態的 CSS 樣式在 src/style.css（#console-panel、.console-output、.console-status）
- [ ] T024 [US1] 修改 index.html — 在 #code-panel 內 #code-editor 下方加入 #console-panel 容器、在 toolbar 加入「執行」和「停止」按鈕
- [ ] T025 [US1] 修改 src/ui/App.ts — 整合 SemanticInterpreter 和 ConsolePanel：setupInterpreter() 方法、Run/Stop 按鈕事件、從 SyncController.getCurrentModel() 取得 SemanticModel 並執行

**檢查點**: 直譯器核心測試全部通過，瀏覽器中按「執行」可看到 console 輸出

---

## Phase 4: User Story 2 — 虛擬標準輸入 (P2)

**目標**: 程式能讀取使用者輸入值，支援預填佇列和 console 行內輸入

**獨立測試**: 建立 input + print 程式，預填輸入值後執行，驗證輸出正確

### 測試先行

- [ ] T026 [P] [US2] 撰寫 input 相關測試在 tests/unit/interpreter.test.ts — input 從佇列讀取、input 型別轉換（string→int）、佇列耗盡暫停、型別不符錯誤

### 實作

- [ ] T027 [US2] 實作 input 概念解釋在 src/interpreter/interpreter.ts — 從 IOSystem 讀取輸入、型別轉換、佇列耗盡時暫停執行
- [ ] T028 [US2] 修改 ConsolePanel 在 src/ui/console-panel.ts — 新增行內輸入 UI（底部 input 元素、Enter 送出、提示文字）
- [ ] T029 [US2] 修改 src/ui/App.ts — 整合 input 等待流程：暫停→顯示輸入→使用者送出→恢復執行、預填輸入 textarea
- [ ] T030 [US2] 修改 index.html — 在 console 面板旁新增 stdin 預填 textarea（可摺疊）

**檢查點**: input 測試通過，瀏覽器中程式可讀取預填輸入或行內輸入

---

## Phase 5: User Story 3 — 逐步執行 (P3)

**目標**: 使用者可一次執行一個語句，看到目前執行的積木和程式碼行高亮

**獨立測試**: 建立迴圈程式，反覆按 Step，驗證積木和程式碼行高亮正確移動

### 測試先行

- [ ] T031 [P] [US3] 撰寫 StepController 單元測試在 tests/unit/step-controller.test.ts（step 模式、速度切換、暫停/繼續、停止重置）

### 實作

- [ ] T032 [US3] 實作 StepController 類別在 src/ui/step-controller.ts（step、run、pause、resume、stop、setSpeed、onStep callback）
- [ ] T033 [US3] 修改 SemanticInterpreter 在 src/interpreter/interpreter.ts — 新增 stepMode：每個語句回傳目前 SemanticNode（含 metadata.blockId 和 sourceRange）供高亮使用
- [ ] T034 [US3] 修改 index.html — 在 toolbar 加入「逐步」「暫停/繼續」按鈕和速度選擇器（慢/中/快）
- [ ] T035 [US3] 修改 src/ui/App.ts — 整合 StepController：Step/Pause/Continue 按鈕事件、每步呼叫 highlightBlock() 和 addHighlight()、速度切換、積木修改時自動停止
- [ ] T036 [US3] 新增逐步執行相關 CSS 樣式在 src/style.css（速度選擇器、暫停按鈕狀態切換）

**檢查點**: StepController 測試通過，瀏覽器中逐步執行可看到積木和程式碼行高亮

---

## Phase 6: User Story 4 — 變數監看面板 (P4)

**目標**: 即時顯示所有可見變數的名稱、型別和值，值變化時有視覺提示

**獨立測試**: 執行宣告和修改變數的程式，驗證監看面板顯示正確且值變化有視覺提示

### 測試先行

- [ ] T037 [P] [US4] 撰寫 VariablePanel 單元測試在 tests/unit/variable-panel.test.ts（更新顯示、值變化偵測、scope 層級顯示、函式回傳清除）

### 實作

- [ ] T038 [US4] 實作 VariablePanel 類別在 src/ui/variable-panel.ts（update(scope)、clear、getElement、值變化 flash 動畫）
- [ ] T039 [US4] 修改 index.html — 在 #code-panel 內 #console-panel 上方或旁邊加入 #variable-panel 容器
- [ ] T040 [US4] 新增 variable-panel CSS 樣式在 src/style.css（表格佈局、值變化 flash 動畫、scope 層級標示）
- [ ] T041 [US4] 修改 src/ui/App.ts — 每步執行後呼叫 VariablePanel.update(currentScope)、執行結束時清除

**檢查點**: 變數面板測試通過，瀏覽器中逐步執行可看到變數即時更新

---

## Phase 7: Polish（收尾與整合驗證）

**目的**: 跨故事整合測試、邊界情況驗證、quickstart 場景驗收

- [ ] T042 [P] 撰寫端對端整合測試在 tests/integration/interpreter-integration.test.ts — 涵蓋 quickstart.md 8 個場景
- [ ] T043 驗證所有測試通過並確認 npm run build 成功
- [ ] T044 在瀏覽器中手動驗證 quickstart.md 所有 8 個場景

---

## 依賴與執行順序

### Phase 依賴

- **Phase 1 (Setup)**: 無依賴 — 立即開始
- **Phase 2 (Foundational)**: 依賴 Phase 1 — 阻擋所有使用者故事
- **Phase 3 (US1)**: 依賴 Phase 2 — MVP 核心
- **Phase 4 (US2)**: 依賴 Phase 3（需要直譯器核心和 ConsolePanel）
- **Phase 5 (US3)**: 依賴 Phase 3（需要直譯器核心和 UI 整合）
- **Phase 6 (US4)**: 依賴 Phase 5（需要逐步執行機制）
- **Phase 7 (Polish)**: 依賴所有使用者故事完成

### 使用者故事依賴

- **US1 (P1)**: 無故事間依賴 — MVP
- **US2 (P2)**: 依賴 US1（擴充 interpreter 的 input 概念和 ConsolePanel）
- **US3 (P3)**: 依賴 US1（需要 interpreter 核心和 UI 基礎）
- **US4 (P4)**: 依賴 US3（需要逐步執行提供的每步 callback）

### 各故事內平行機會

**Phase 2**:
```
T005 Scope 測試 ∥ T006 IOSystem 測試
→ T007 Scope 實作 ∥ T008 IOSystem 實作
```

**Phase 3 (US1)**:
```
T009 基礎測試 ∥ T010 運算測試 ∥ T011 流程測試 ∥ T012 函式測試 ∥ T013 陣列測試 ∥ T014 邊界測試
→ T015~T021 直譯器實作（循序）
→ T022 ConsolePanel ∥ T023 CSS
→ T024 HTML ∥ T025 App.ts
```

---

## 實作策略

### MVP 先行（僅 User Story 1）

1. 完成 Phase 1: Setup
2. 完成 Phase 2: Foundational（關鍵 — 阻擋所有故事）
3. 完成 Phase 3: User Story 1
4. **停下並驗證**: 獨立測試 US1
5. 可部署/展示

### 漸進交付

1. Setup + Foundational → 基礎就緒
2. 加入 US1 → 獨立測試 → 部署（MVP！）
3. 加入 US2 → 獨立測試 → 部署
4. 加入 US3 → 獨立測試 → 部署
5. 加入 US4 → 獨立測試 → 部署
6. 每個故事在不破壞前一個的情況下增加價值

---

## 備註

- [P] 任務 = 不同檔案、無依賴，可平行執行
- [Story] 標籤將任務對應到特定使用者故事以利追蹤
- 測試必須先寫並確認失敗後才實作（TDD 紅 → 綠 → 重構）
- 每個任務或邏輯群組完成後 commit
- 在任何檢查點可停下獨立驗證故事
