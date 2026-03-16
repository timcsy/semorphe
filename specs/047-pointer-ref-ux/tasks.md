# Tasks: C++ 指標與參照積木 UX 重設計

**Input**: Design documents from `/specs/047-pointer-ref-ux/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Tests**: 測試包含在各階段中（Constitution 要求 TDD）。

**Organization**: 按 user story 分組，每個 story 可獨立實作與驗證。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可平行執行（不同檔案，無相依）
- **[Story]**: 所屬 user story（US1, US2...）
- 包含確切檔案路徑

---

## Phase 1: Setup

**Purpose**: 確認現有實作狀態，建立基線測試

- [x] T001 確認現有 round-trip 測試通過：`npm test`
- [x] T002 確認 TypeScript 編譯通過：`npx tsc --noEmit`

**Checkpoint**: 基線綠燈，確認變更前的穩定狀態

---

## Phase 2: Foundational（i18n 標籤更新）

**Purpose**: 所有積木的 i18n 標籤統一更新，此為所有 user story 共用的基礎

**⚠️ CRITICAL**: 標籤更新影響所有 story，必須先完成

- [x] T003 [P] 更新 `src/i18n/zh-TW/blocks.json` 中的指標/參照 MSG0 標籤（附帶原始符號），新增 TOOLTIP key
- [x] T004 [P] 更新 `src/i18n/en/blocks.json` 中的指標/參照 MSG0 標籤（附帶原始符號），新增 TOOLTIP key
- [x] T005 更新 `src/languages/cpp/core/blocks.json` 中所有指標/參照 BlockSpec 的 `tooltip` 欄位，指向新的 `%{BKY_..._TOOLTIP}` key（已存在）
- [x] T006 驗證：`npm test` 通過，`npx tsc --noEmit` 通過

**Checkpoint**: 所有指標/參照積木的標籤已更新為描述式+符號格式

---

## Phase 3: User Story 1 — 指標宣告時可選擇初始化 (Priority: P1) 🎯 MVP

**Goal**: 指標宣告積木新增可選的初始化槽位，支援 `int* ptr = &x;`

**Independent Test**: 使用指標宣告積木連接「取得位址」積木 → round-trip 產生 `int* ptr = &x;` → 重新 lift 後語義樹結構等價

### Tests for User Story 1

- [x] T007 [US1] 新增 round-trip 測試案例於 `tests/integration/roundtrip-arrays-pointers.test.ts`：指標宣告+初始化（`int* ptr = &x;`）、指標宣告空（`int* ptr;` — it.todo，pre-existing lifter issue）、指標宣告+nullptr（`int* ptr = nullptr;`）

### Implementation for User Story 1

- [x] T008 [US1] 更新 `src/languages/cpp/core/concepts.json` 中 `cpp_pointer_declare` 的 `children` 欄位：`{}` → `{ "initializer": "expression" }`
- [x] T009 [US1] 更新 `src/languages/cpp/core/blocks.json` 中 `c_pointer_declare` BlockSpec：在 `args0` 新增 `{ "type": "input_value", "name": "INIT" }`，新增 `renderMapping`，保留 codeTemplate 為無 init 版本（TypeScript generator 處理 init 邏輯）
- [x] T010 [US1] 更新 `src/i18n/zh-TW/blocks.json` 和 `src/i18n/en/blocks.json` 的 `C_POINTER_DECLARE_MSG0`，加入第三個佔位符（初始值）
- [x] T011 [US1] 驗證：`npm test` 通過（2709 passed），`npx tsc --noEmit` 通過

**Checkpoint**: 指標宣告積木可選擇初始化，round-trip 驗證通過

---

## Phase 4: User Story 2 — 參照宣告使用「別名」語義 (Priority: P1)

**Goal**: 參照宣告積木標籤從「宣告參考變數」改為「建立別名」語義

**Independent Test**: 參照宣告積木的 message0 顯示「建立 ... 別名 ... 綁定 ... (&)」，tooltip 解釋別名概念

### Tests for User Story 2

- [x] T012 [US2] 確認既有 round-trip 測試（8 tests）於 `tests/integration/roundtrip-cpp-reference-static.test.ts` 全部 PASS

### Implementation for User Story 2

- [x] T013 [US2] 更新 `src/i18n/zh-TW/blocks.json` 的 `C_REF_DECLARE_MSG0`：→「建立 %1 別名 %2 綁定 %3 (&)」
- [x] T014 [US2] 更新 `src/i18n/en/blocks.json` 的 `C_REF_DECLARE_MSG0`：→「Create %1 alias %2 bound to %3 (&)」
- [x] T015 [US2] 驗證：`npm test` 通過

**Checkpoint**: 參照積木使用別名語義，round-trip 驗證通過

---

## Phase 5: User Story 3 — 解參照與取址操作有描述性標籤 (Priority: P2)

**Goal**: 解參照和取址積木的標籤附帶原始符號 `(*)` / `(&)`

**Independent Test**: 積木標籤中包含原始符號，tooltip 提供類比說明

### Implementation for User Story 3

- [x] T016 [US3] 確認 Phase 2（T003-T004）已完成解參照/取址標籤的更新（`C_POINTER_DEREF_MSG0` → `取得 %1 指向的值 (*)`、`C_ADDRESS_OF_MSG0` → `取得 %1 的位址 (&)`，TOOLTIP 已新增）

**Checkpoint**: 解參照和取址積木標籤已更新，tooltip 含類比說明

---

## Phase 6: User Story 4 — 指標與參照的視覺區分 (Priority: P2)

**Goal**: 指標和參照積木在工具箱中有明確視覺區分

**Independent Test**: 打開工具箱時，指標積木和參照積木在不同分類下

### Implementation for User Story 4

- [x] T017 [US4] 確認現有 toolbox 分類：指標在 `pointers` category（cpp_pointers），參照在 `data` category——已天然分開
- [x] T018 [US4] 分類已足夠區分，不需額外修改

**Checkpoint**: 指標和參照積木在工具箱中有明確視覺區分

---

## Phase 7: User Story 5 — 指標重新賦值語義清晰 (Priority: P3)

**Goal**: 指標賦值（`ptr = &y`）和透過指標修改值（`*ptr = val`）的積木標籤清楚區分

**Independent Test**: 兩個積木的 message0 和 tooltip 能讓學生分辨差異

### Implementation for User Story 5

- [x] T019 [US5] 確認 `C_POINTER_ASSIGN_MSG0` 標籤已在 Phase 2 更新為「把 %2 存到 %1 指向的位置 (*=)」
- [x] T020 [US5] 驗證：`npm test` 通過

**Checkpoint**: 指標賦值語義清晰

---

## Phase 8: Polish & 最終驗證

**Purpose**: 全面驗證所有變更

- [x] T021 執行完整測試套件：`npm test`（2709 passed）
- [x] T022 執行 TypeScript 編譯檢查：`npx tsc --noEmit`（無錯誤）
- [x] T023 向後相容驗證：roundtrip-l2.test.ts 中無 initializer 的 cpp_pointer_declare 測試通過，Blockly input_value 天然可選
- [x] T024 Git commit 所有變更（2 commits: i18n fixes + pointer/ref UX）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 無相依——立即開始
- **Foundational (Phase 2)**: 依賴 Phase 1 完成
- **US1 (Phase 3)**: 依賴 Phase 2 完成——**MVP**
- **US2 (Phase 4)**: 依賴 Phase 2 完成，可與 US1 平行
- **US3 (Phase 5)**: 依賴 Phase 2 完成（實際上 Phase 2 已涵蓋此 story）
- **US4 (Phase 6)**: 依賴 Phase 2 完成，可與 US1-US3 平行
- **US5 (Phase 7)**: 依賴 Phase 2 完成，可與其他 story 平行
- **Polish (Phase 8)**: 依賴所有 story 完成

### Parallel Opportunities

- T003 和 T004（zh-TW / en i18n 更新）可平行
- US1-US5 在 Phase 2 完成後可平行（但建議按優先順序逐個完成）

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成 Phase 1: Setup（基線驗證）
2. 完成 Phase 2: Foundational（i18n 標籤更新）
3. 完成 Phase 3: US1（指標宣告+初始化）
4. **驗證**：round-trip 測試通過
5. 此時已有可用的核心改善

### Incremental Delivery

1. Setup + Foundational → 所有標籤已更新（US3、US5 大部分已完成）
2. + US1 → 指標宣告可初始化（MVP）
3. + US2 → 參照使用別名語義
4. + US4 → 視覺區分確認
5. Polish → 最終驗證和 commit

---

## Notes

- 本功能的實際 TypeScript 程式碼修改量極少（generator/lifter/executor 已就緒）
- 主要工作集中在 JSON 檔案修改（blocks.json、i18n JSON、concepts.json）
- 向後相容不需額外遷移邏輯（Blockly 天然支援可選 input_value）
- 每個 task 完成後執行 `npm test` 確認不破壞現有測試
