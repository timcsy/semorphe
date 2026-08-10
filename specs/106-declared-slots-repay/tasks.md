# Tasks: 宣告完整性清償

**紀律**：一顆一個 commit。任一顆紅 → 還原那一顆。

## Phase 1: Foundational

- [ ] T001 寫「宣告改動不得改變行為」的機械檢查 in `tests/integration/declaration-change-parity.test.ts`：錄下一組真實程式碼的產生碼／執行輸出／來回轉換，作為 15 顆改動的共同對照組（FR-003、SC-003）
- [ ] T002 確認它在改動前是綠的（基準有效）

## Phase 2: A 類——宣告寫錯槽（6 顆）

FR-004 已量過：六顆的那個屬性**全部出現 0 次**，是死宣告。

- [ ] T003 `cpp:func_call`：`args` 從 properties 移到 children
- [ ] T004 `cpp:method_call`：同上
- [ ] T005 `cpp:print_formatted`：同上
- [ ] T006 `cpp:input_formatted`：同上
- [ ] T007 `cpp:forward_decl`：`params` 從 properties 移到 children
- [ ] T008 `cpp:func_def`：同上（⚠️ 最常用的一顆，單獨一個 commit）

## Phase 3: B 類——純粹漏宣告（9 顆）

- [ ] T009 `cpp:array_declare` + `values`
- [ ] T010 `cpp:var_declare` + `declarators`
- [ ] T011 `cpp:class_def` + `protected`
- [ ] T012 `cpp:input` + `values`
- [ ] T013 `cpp:string_declare` + `initializer`
- [ ] T014 `cpp:ifstream_declare` + `initializer`
- [ ] T015 `cpp:ofstream_declare` + `initializer`
- [ ] T016 `cpp:string_find` + `from`
- [ ] T017 `cpp:string_append_char` + `value`

## Phase 4: 收數字

- [ ] T018 #30 確定違規 = **1**（只剩 `cpp:if`）；SC-002：`args`／`params` 在 A 類六顆的屬性宣告裡出現 **0** 次
- [ ] T019 兩條護欄基線**同一次提交**調整，說明欄註明「因為宣告了」並互相引用（FR-006／FR-007）
- [ ] T020 存檔版本仍是 v9；`npm test && npm run build`
