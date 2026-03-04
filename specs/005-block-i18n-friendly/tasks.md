# Tasks: 積木文字全面中文化與初學者友善改善

**Input**: Design documents from `/specs/005-block-i18n-friendly/`
**Prerequisites**: plan.md, spec.md, data-model.md, research.md, quickstart.md

**Tests**: 測試更新包含在 US4（P2）中，因為 spec 明確要求確保所有測試通過。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: User Story 1 - Universal 積木文字友善化 (Priority: P0) 🎯 MVP

**Goal**: 將 22 個 universal 積木的 message、tooltip、下拉選單改為中文友善版本

**Independent Test**: 開啟應用程式，拖出所有 universal 積木，檢查 message/tooltip/下拉選單皆為中文

### Implementation for User Story 1

- [X] T001 [US1] 更新 universal.json 中資料類別積木（u_var_declare, u_var_assign, u_var_ref, u_number, u_string）的 message、tooltip、型別下拉 label，依照 data-model.md 對照表修改 `src/blocks/universal.json`
- [X] T002 [US1] 更新 universal.json 中運算類別積木（u_arithmetic, u_compare, u_logic, u_logic_not）的 tooltip，依照 data-model.md 對照表修改 `src/blocks/universal.json`
- [X] T003 [US1] 更新 universal.json 中控制類別積木（u_count_loop, u_while_loop, u_break, u_continue）的 tooltip，依照 data-model.md 對照表修改 `src/blocks/universal.json`
- [X] T004 [US1] 更新 universal.json 中函式類別積木（u_func_def, u_func_call, u_return）的 message、tooltip、回傳型別下拉 label，依照 data-model.md 對照表修改 `src/blocks/universal.json`
- [X] T005 [US1] 更新 universal.json 中輸入輸出類別積木（u_print, u_endl, u_input）的 message、tooltip，依照 data-model.md 對照表修改 `src/blocks/universal.json`
- [X] T006 [US1] 更新 universal.json 中陣列類別積木（u_array_declare, u_array_access）的 message、tooltip、型別下拉 label，依照 data-model.md 對照表修改 `src/blocks/universal.json`

**Checkpoint**: Universal 積木全部中文化完成，可在瀏覽器中驗證

---

## Phase 2: User Story 2 - Basic/Special 積木中文化 (Priority: P1)

**Goal**: 將 basic.json（10 個）和 special.json（9 個）積木的 message、tooltip、下拉選單改為中文

**Independent Test**: 切換到進階模式，檢查 basic/special 積木的 message/tooltip/下拉選單

### Implementation for User Story 2

- [X] T007 [P] [US2] 更新 basic.json 中值與運算積木（c_char_literal, c_increment, c_compound_assign）的 message、tooltip、dropdown label，依照 data-model.md 對照表修改 `src/languages/cpp/blocks/basic.json`
- [X] T008 [US2] 更新 basic.json 中條件積木（c_switch, c_case）的 message、tooltip，依照 data-model.md 對照表修改 `src/languages/cpp/blocks/basic.json`
- [X] T009 [US2] 更新 basic.json 中迴圈積木（c_for_loop, c_do_while）的 message、tooltip，依照 data-model.md 對照表修改 `src/languages/cpp/blocks/basic.json`
- [X] T010 [US2] 更新 basic.json 中輸入輸出積木（c_printf, c_scanf）的 message、tooltip，依照 data-model.md 對照表修改 `src/languages/cpp/blocks/basic.json`
- [X] T011 [P] [US2] 更新 special.json 中原始碼積木（c_raw_code, c_raw_expression）的 message、tooltip，依照 data-model.md 對照表修改 `src/languages/cpp/blocks/special.json`
- [X] T012 [US2] 更新 special.json 中預處理器積木（c_include, c_include_local, c_define, c_ifdef, c_ifndef）的 message、tooltip、#include 下拉 label，依照 data-model.md 對照表修改 `src/languages/cpp/blocks/special.json`
- [X] T013 [US2] 更新 special.json 中其他積木（c_comment_line, c_using_namespace）的 message、tooltip，依照 data-model.md 對照表修改 `src/languages/cpp/blocks/special.json`

**Checkpoint**: Basic/Special 積木全部中文化完成

---

## Phase 3: User Story 3 - Advanced 積木中文化 (Priority: P1)

**Goal**: 將 advanced.json（27 個）積木的 message、tooltip、下拉選單改為中文

**Independent Test**: 切換到進階模式，檢查 advanced 積木的 message/tooltip/下拉選單

### Implementation for User Story 3

- [X] T014 [P] [US3] 更新 advanced.json 中指標類別積木（c_pointer_declare, c_pointer_deref, c_address_of, c_malloc, c_free）的 message、tooltip、型別下拉 label，依照 data-model.md 對照表修改 `src/languages/cpp/blocks/advanced.json`
- [X] T015 [P] [US3] 更新 advanced.json 中結構類別積木（c_struct_declare, c_struct_member_access, c_struct_pointer_access）的 message、tooltip，依照 data-model.md 對照表修改 `src/languages/cpp/blocks/advanced.json`
- [X] T016 [P] [US3] 更新 advanced.json 中字串類別積木（c_strlen, c_strcmp, c_strcpy）的 message、tooltip，依照 data-model.md 對照表修改 `src/languages/cpp/blocks/advanced.json`
- [X] T017 [US3] 更新 advanced.json 中容器類別積木（cpp_vector_declare, cpp_vector_push_back, cpp_vector_size, cpp_map_declare, cpp_string_declare, cpp_stack_declare, cpp_queue_declare, cpp_set_declare, cpp_method_call, cpp_method_call_expr）的 message、tooltip、型別下拉 label，依照 data-model.md 對照表修改 `src/languages/cpp/blocks/advanced.json`
- [X] T018 [P] [US3] 更新 advanced.json 中演算法積木（cpp_sort）的 message、tooltip，依照 data-model.md 對照表修改 `src/languages/cpp/blocks/advanced.json`
- [X] T019 [P] [US3] 更新 advanced.json 中物件導向積木（cpp_class_def, cpp_new, cpp_delete）的 message、tooltip，依照 data-model.md 對照表修改 `src/languages/cpp/blocks/advanced.json`
- [X] T020 [P] [US3] 更新 advanced.json 中樣板積木（cpp_template_function）的 message、tooltip，依照 data-model.md 對照表修改 `src/languages/cpp/blocks/advanced.json`

**Checkpoint**: Advanced 積木全部中文化完成

---

## Phase 4: User Story 4 - 動態積木同步與測試驗證 (Priority: P2)

**Goal**: 同步更新動態積木文字，確保所有測試通過，驗證程式碼生成不受影響

**Independent Test**: 執行全部測試確認通過，瀏覽器中測試 round-trip 轉換正常

### Implementation for User Story 4

- [X] T021 [US4] 更新 blockly-editor.ts 中 u_var_declare 動態積木的型別下拉 label 和 tooltip，依照 data-model.md 型別下拉標準對照表修改 `src/ui/blockly-editor.ts`
- [X] T022 [US4] 更新 blockly-editor.ts 中 u_func_def 動態積木的回傳型別下拉 label 和 tooltip，依照 data-model.md 型別下拉標準對照表修改 `src/ui/blockly-editor.ts`
- [X] T023 [US4] 更新 blockly-editor.ts 中 u_input（u_input_multi）動態積木的 message 加入「變數」身份標示，確認 u_print 和 u_var_ref 的 tooltip 為白話，修改 `src/ui/blockly-editor.ts`
- [X] T024 [US4] 檢查並更新 tests/integration/ux-features.test.ts 中引用積木 message 字串的測試案例，確保與新文字一致 `tests/integration/ux-features.test.ts`
- [X] T025 [US4] 執行全部測試（`npm test`），修復因文字改動導致的測試失敗 `tests/`
- [X] T026 [US4] 在瀏覽器中驗證程式碼→積木→程式碼 round-trip 功能正常，確認程式碼生成結果未受影響

**Checkpoint**: 所有動態積木同步完成，全部測試通過

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 最終驗證與清理

- [X] T027 執行 quickstart.md 中 5 個驗證場景的檢查
- [X] T028 Git commit 所有改動

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (US1 - Universal)**: 無前置依賴，可立即開始。MVP 核心。
- **Phase 2 (US2 - Basic/Special)**: 無前置依賴，可與 Phase 1 並行。修改不同檔案。
- **Phase 3 (US3 - Advanced)**: 無前置依賴，可與 Phase 1/2 並行。修改不同檔案。
- **Phase 4 (US4 - Dynamic+Tests)**: 依賴 Phase 1-3 完成（需要所有 JSON 積木文字已更新後才能同步動態積木和驗證測試）
- **Phase 5 (Polish)**: 依賴 Phase 4 完成

### User Story Dependencies

- **US1 (P0)**: 獨立。修改 `src/blocks/universal.json`
- **US2 (P1)**: 獨立。修改 `src/languages/cpp/blocks/basic.json` + `special.json`
- **US3 (P1)**: 獨立。修改 `src/languages/cpp/blocks/advanced.json`
- **US4 (P2)**: 依賴 US1-3。修改 `src/ui/blockly-editor.ts` + `tests/`

### Within Each User Story

- JSON 積木改動按類別順序進行
- 同一檔案內的 task 必須循序執行
- 不同檔案的 task 可並行

### Parallel Opportunities

- Phase 1/2/3 可並行執行（修改不同 JSON 檔案）
- Phase 2 中 T007-T010（basic.json）和 T011-T013（special.json）可並行
- Phase 3 中 T014-T020 標記 [P] 的可並行（同一 JSON 檔但修改不同區塊段落）

---

## Parallel Example: Phase 1/2/3

```text
# 三個 Phase 可同時進行（不同檔案）：
Phase 1: universal.json（T001-T006）
Phase 2: basic.json（T007-T010）+ special.json（T011-T013）
Phase 3: advanced.json（T014-T020）

# Phase 2 內部可並行：
基本積木: basic.json（T007-T010）
特殊積木: special.json（T011-T013）
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成 Phase 1: Universal 積木中文化
2. **STOP and VALIDATE**: 瀏覽器中檢查所有 universal 積木
3. 確認無破壞後繼續

### Incremental Delivery

1. US1 (Universal) → 驗證 → 80% 的初學者使用體驗已改善
2. US2 (Basic/Special) + US3 (Advanced) → 驗證 → 100% 積木中文化
3. US4 (Dynamic + Tests) → 全部測試通過 → 功能完成
4. Polish → 最終確認

---

## Notes

- 所有 JSON 改動只改 message/tooltip/dropdown label，不改 field value
- 型別下拉統一使用 data-model.md 中的標準對照表
- T001-T020 的 JSON 改動不需要執行測試（不影響邏輯）
- T025 是關鍵驗證點：確認所有測試通過
- Commit 建議：每完成一個 Phase 做一次 commit
