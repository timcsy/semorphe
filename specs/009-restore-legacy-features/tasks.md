# Tasks: 整合舊版已驗證功能至新架構

**Input**: Design documents from `/specs/009-restore-legacy-features/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 建立所有 User Story 共用的基礎元件

- [x] T001 建立 BottomPanel 分頁切換元件（Console/變數面板容器）in src/ui/layout/bottom-panel.ts
- [x] T002 建立 Toast 通知元件 in src/ui/toolbar/toast.ts
- [x] T003 擴充 i18n 翻譯檔，新增執行、面板、診斷、快速存取相關的 key in src/i18n/en/ 和 src/i18n/zh-TW/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Source Mapping 基礎設施 — 雙向高亮和逐步執行都依賴此機制

- [x] T004 擴充 code-generator 在生成程式碼時同步產生 SourceMapping（blockId → startLine/endLine）in src/core/projection/code-generator.ts
- [x] T005 擴充 SyncController 儲存 SourceMapping 結果，提供 getMappingForBlock(blockId) 和 getMappingForLine(line) 查詢 API in src/ui/sync-controller.ts
- [x] T006 在 app.new.ts 中整合 BottomPanel 到右側佈局（Monaco Editor 上方 + BottomPanel 下方），替換現有的單一 Monaco 面板結構 in src/ui/app.new.ts

**Checkpoint**: BottomPanel 可見、SourceMapping 在每次同步後產生、基礎佈局完成

---

## Phase 3: User Story 1 - 程式執行與即時回饋 (Priority: P1)

**Goal**: 學習者可以執行積木程式、看到 Console 輸出、逐步執行並監看變數

**Independent Test**: 建立簡單積木程式（如印出 "Hello"）→ 點擊執行 → Console 顯示輸出

### Implementation for User Story 1

- [x] T007 [US1] 升級 ConsolePanel：新增 promptInput()（內聯輸入）、setStatus()（狀態列）、自動捲動、清除功能 in src/ui/panels/console-panel.ts
- [x] T008 [US1] 升級 VariablePanel：新增 ScopeGroup 分組顯示、可收合父作用域、變數值變更高亮 in src/ui/panels/variable-panel.ts
- [x] T009 [US1] 在 app.new.ts 新增執行控制按鈕（執行/逐步/暫停/停止/速度選擇）到工具列 in src/ui/app.new.ts
- [x] T010 [US1] 在 app.new.ts 整合 SemanticInterpreter 執行流程：點擊「執行」→ extractSemanticTree → interpreter.execute → ConsolePanel 輸出 in src/ui/app.new.ts
- [x] T011 [US1] 整合 stdin 互動：interpreter 的 io.read() 呼叫 ConsolePanel.promptInput() 回傳 Promise<string> in src/ui/app.new.ts
- [x] T012 [US1] 整合逐步執行流程：StepController + interpreter.executeWithSteps → 每步更新 VariablePanel、高亮當前積木和程式碼行 in src/ui/app.new.ts
- [x] T013 [US1] 實作未同步偵測：執行前檢查積木是否已修改但未同步，顯示提示對話讓學習者選擇 in src/ui/app.new.ts
- [x] T014 [US1] 實作無窮迴圈保護：interpreter 超過 maxSteps 後中止，Console 顯示逾時警告 in src/ui/app.new.ts

**Checkpoint**: 可執行程式、看到輸出、逐步執行看到變數變化、stdin 互動正常

---

## Phase 4: User Story 2 - 雙向高亮與同步方向提示 (Priority: P2)

**Goal**: 選取積木時程式碼對應行高亮，反之亦然；未同步時按鈕有視覺提示

**Independent Test**: 點選積木 → 程式碼行高亮；移動程式碼游標 → 積木高亮

### Implementation for User Story 2

- [x] T015 [P] [US2] 擴充 BlocklyPanel：新增 onBlockSelect(callback) 事件和 highlightBlock(blockId)/clearHighlight() 方法 in src/ui/panels/blockly-panel.ts
- [x] T016 [P] [US2] 擴充 MonacoPanel：新增 addHighlight(startLine, endLine)/clearHighlight()、onCursorChange(callback) 事件 in src/ui/panels/monaco-panel.ts
- [x] T017 [US2] 在 app.new.ts 整合雙向高亮事件流：BlocklyPanel.onBlockSelect → 查 SourceMapping → MonacoPanel.addHighlight，反向亦然 in src/ui/app.new.ts
- [x] T018 [US2] 實作同步方向提示：積木修改後「積木→程式碼」按鈕顯示視覺提示（CSS class），程式碼修改後「程式碼→積木」按鈕顯示提示，同步後消失 in src/ui/app.new.ts

**Checkpoint**: 雙向高亮正常運作、同步按鈕提示正確反映兩側一致性

---

## Phase 5: User Story 3 - 進階積木互動 (Priority: P3)

**Goal**: if 積木支援動態 else-if/else、變數參考下拉、多變數 input、積木診斷

**Independent Test**: 拖出 if 積木 → 用齒輪/+按鈕新增 else-if → 驗證積木結構

### Implementation for User Story 3

- [x] T019 [US3] 實作 u_if_else mutator 齒輪 + +/- 按鈕：支援動態新增/移除 else-if 分支和 else 區塊，含 decompose/compose/saveExtraState/loadExtraState in src/ui/blockly-editor.ts（動態積木註冊區）
- [x] T020 [US3] 更新 u_if_else 的 adapter extract/generate 邏輯以支援動態 else-if 數量 in src/languages/cpp/adapter.ts
- [x] T021 [US3] 更新 code-to-blocks.ts 處理 if-else-if 鏈的 SemanticNode → Blockly extraState 轉換 in src/core/code-to-blocks.ts
- [x] T022 [US3] 實作 u_input 多變數支援：+/- 按鈕動態新增/移除變數欄位，生成 cin >> a >> b >> c in src/ui/blockly-editor.ts 和 src/languages/cpp/adapter.ts
- [x] T023 [US3] 實作變數參考下拉選單自動收集：u_var_ref 的 generateOptions_ 掃描工作區所有 u_var_declare 的變數名稱 in src/ui/blockly-editor.ts
- [x] T024 [US3] 建立積木診斷系統：掃描工作區積木配置問題（缺少連接、空欄位），在積木上顯示警告圖示 in src/core/diagnostics.ts
- [x] T025 [US3] 在 app.new.ts 中整合診斷系統：每次積木變更後自動執行診斷，結果顯示在積木上 in src/ui/app.new.ts

**Checkpoint**: if 積木可動態調整結構、變數參考正確列出已宣告變數、診斷正常運作

---

## Phase 6: User Story 4 - 輔助功能與擴充性 (Priority: P4)

**Goal**: 快速存取列、斷點、自訂積木上傳、Toast 通知

**Independent Test**: 點擊快速存取按鈕 → 積木出現在工作區

### Implementation for User Story 4

- [x] T026 [P] [US4] 建立 QuickAccessBar 元件：依認知層級顯示常用積木按鈕，點擊在工作區中央建立積木 in src/ui/toolbar/quick-access-bar.ts
- [x] T027 [P] [US4] 擴充 MonacoPanel 支援斷點：點擊行號旁 gutter 設置/移除斷點標記，提供 getBreakpoints() API in src/ui/panels/monaco-panel.ts
- [x] T028 [US4] 在 app.new.ts 整合 QuickAccessBar 到積木編輯器上方 in src/ui/app.new.ts
- [x] T029 [US4] 整合斷點與逐步執行：StepController 在到達斷點行時自動暫停 in src/ui/app.new.ts
- [x] T030 [US4] 實作自訂積木上傳功能：匯入 JSON 檔案、驗證格式、動態加入工具箱 in src/ui/app.new.ts
- [x] T031 [US4] 在所有操作（匯出/匯入/上傳/執行完成/錯誤）中整合 Toast 通知 in src/ui/app.new.ts

**Checkpoint**: 快速存取列可用、斷點功能正常、自訂積木可上傳、Toast 通知正確顯示

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 跨 User Story 的整合測試和收尾

- [x] T032 [P] 新增 step-controller 單元測試 in tests/unit/ui/step-controller.test.ts
- [x] T033 [P] 新增 console-panel 單元測試 in tests/unit/ui/console-panel.test.ts
- [x] T034 [P] 新增 bottom-panel 單元測試 in tests/unit/ui/bottom-panel.test.ts
- [x] T035 [P] 新增 quick-access-bar 單元測試 in tests/unit/ui/quick-access.test.ts
- [x] T036 [P] 新增 diagnostics 單元測試 in tests/unit/core/diagnostics.test.ts
- [x] T037 [P] 新增 source-mapping 整合測試 in tests/integration/source-mapping.test.ts
- [x] T038 [P] 新增 execution-flow 整合測試 in tests/integration/execution-flow.test.ts
- [x] T039 [P] 新增 block-mutations 整合測試（else-if/var-ref/input）in tests/integration/block-mutations.test.ts
- [x] T040 執行 npx vitest run 確認所有既有和新增測試通過
- [x] T041 執行 quickstart.md 10 個驗證場景的手動驗收

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (T001 for BottomPanel)
- **US1 (Phase 3)**: Depends on Phase 2 (BottomPanel 佈局 + SourceMapping)
- **US2 (Phase 4)**: Depends on Phase 2 (SourceMapping)；可與 US1 平行
- **US3 (Phase 5)**: Depends on Phase 1 only；可與 US1/US2 平行
- **US4 (Phase 6)**: Depends on Phase 1 (Toast)；T029 depends on US1 (StepController 整合)
- **Polish (Phase 7)**: Depends on all user stories

### User Story Dependencies

- **US1 (P1)**: Phase 2 完成後可開始，不依賴其他 Story
- **US2 (P2)**: Phase 2 完成後可開始，不依賴 US1（但雙向高亮在逐步執行中也使用）
- **US3 (P3)**: Phase 1 完成後即可開始（不需要 SourceMapping），獨立於 US1/US2
- **US4 (P4)**: 大部分獨立，T029（斷點整合）需要 US1 的逐步執行先完成

### Within Each User Story

- ConsolePanel/VariablePanel 升級 → 執行整合 → 互動細節
- BlocklyPanel/MonacoPanel 擴充 → 事件流整合
- 積木定義修改 → adapter 更新 → code-to-blocks 更新

### Parallel Opportunities

- T001, T002, T003 可平行（Phase 1 全部）
- T004, T005 可平行（Phase 2 SourceMapping 兩端）
- T007, T008 可平行（Console 和 Variable 面板升級）
- T015, T016 可平行（Blockly 和 Monaco 面板擴充）
- T026, T027 可平行（QuickAccessBar 和斷點）
- T032-T039 全部可平行（測試撰寫）

---

## Parallel Example: User Story 1

```bash
# 先平行升級兩個面板：
Task T007: "升級 ConsolePanel in src/ui/panels/console-panel.ts"
Task T008: "升級 VariablePanel in src/ui/panels/variable-panel.ts"

# 再依序整合到 app.new.ts：
Task T009 → T010 → T011 → T012 → T013 → T014
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T006)
3. Complete Phase 3: User Story 1 (T007-T014)
4. **STOP and VALIDATE**: 執行簡單程式、逐步執行、stdin 互動
5. 可獨立展示核心功能

### Incremental Delivery

1. Setup + Foundational → 基礎佈局完成
2. Add US1 → 程式執行可用 (MVP!)
3. Add US2 → 雙向高亮提升學習體驗
4. Add US3 → 進階積木互動增強表達力
5. Add US4 → 輔助功能提升效率
6. Polish → 測試覆蓋、驗收

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- 主要修改集中在 app.new.ts（整合中心）、panels/（面板升級）、blockly-editor.ts（積木定義）
- 既有的 interpreter（48 tests）和 step-controller 直接複用，不需修改
- Commit after each phase or logical group
