# Tasks: DependencyResolver 抽象 + Program Scaffold

**Input**: Design documents from `/specs/020-dependency-scaffold/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: 依循憲法 TDD 原則，每個 User Story 先寫測試再實作。

**Organization**: 依 User Story 分組，US1→US2→US3→US4 順序執行（有依賴鏈）。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: 建立 regression 基線

- [X] T001 執行現有測試套件，記錄基線結果確認全部通過（84 files, 1555 tests passed）

---

## Phase 2: User Story 1 - 語言無關的依賴解析介面 (Priority: P1) 🎯 MVP

**Goal**: 定義 DependencyResolver 核心介面，C++ ModuleRegistry 實作該介面，移除 getRequiredHeaders，所有呼叫端遷移

**Independent Test**: 核心介面檔案不 import 任何 `languages/` 模組 + C++ auto-include 行為不變

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T002 [P] [US1] 撰寫 DependencyResolver 介面契約測試（空輸入→空結果、去重、排序、未知 concept 忽略）in tests/unit/core/dependency-resolver.test.ts
- [X] T003 [P] [US1] 更新 ModuleRegistry 測試，驗證 resolve() 回傳 DependencyEdge[] 且結果與舊 getRequiredHeaders 一致 in tests/unit/languages/cpp/module-registry.test.ts

### Implementation for User Story 1

- [X] T004 [US1] 建立 DependencyResolver 介面 + DependencyEdge 型別定義 in src/core/dependency-resolver.ts（不 import 任何 languages/ 模組）
- [X] T005 [US1] 重構 ModuleRegistry：實作 DependencyResolver 介面，新增 resolve() 方法，移除 getRequiredHeaders in src/languages/cpp/std/module-registry.ts
- [X] T006 [US1] 更新匯出：從 index.ts 匯出 DependencyResolver 相關型別 in src/languages/cpp/std/index.ts
- [X] T007 [US1] 遷移 auto-include.ts：computeAutoIncludes 改用 DependencyResolver.resolve() in src/languages/cpp/auto-include.ts
- [X] T008 [US1] 遷移 code-generator.ts：GeneratorContext 的 moduleRegistry 型別改為 DependencyResolver in src/core/projection/code-generator.ts
- [X] T009 [US1] 遷移 statements.ts：program generator 改用 DependencyResolver in src/languages/cpp/core/generators/statements.ts
- [X] T010 [US1] 更新 app.ts 接線：setModuleRegistry → setDependencyResolver in src/ui/app.ts
- [X] T011 [US1] 執行完整測試套件，驗證零 regression（85 files, 1566 tests passed）

**Checkpoint**: DependencyResolver 介面完成，C++ auto-include 行為不變，所有現有測試通過

---

## Phase 3: User Story 2 - Program Scaffold 統一 boilerplate 管理 (Priority: P2)

**Goal**: 定義 ProgramScaffold 核心介面，C++ 實作產出 imports/preamble/entryPoint/epilogue，根據認知等級設定 visibility

**Independent Test**: ProgramScaffold 產出結果符合契約（L0→hidden、L1→ghost+reason、L2→editable），manualImports 去重正確

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T012 [P] [US2] 撰寫 ProgramScaffold 介面契約測試（visibility 映射、reason 非空、四區段結構）in tests/unit/core/program-scaffold.test.ts
- [X] T013 [P] [US2] 撰寫 CppScaffold 單元測試（cout+vector 語義樹→正確 imports、preamble、entryPoint、epilogue；manualImports 去重；pinned 項目保持 editable）in tests/unit/languages/cpp/cpp-scaffold.test.ts

### Implementation for User Story 2

- [X] T014 [US2] 建立 ProgramScaffold 介面 + ScaffoldItem/ScaffoldResult/ScaffoldConfig 型別定義 in src/core/program-scaffold.ts（不 import 任何 languages/ 模組）
- [X] T015 [US2] 實作 CppScaffold：消費 DependencyResolver 產生 imports、固定 preamble/entryPoint/epilogue、根據 cognitiveLevel 設定 visibility in src/languages/cpp/cpp-scaffold.ts
- [X] T016 [US2] 執行完整測試套件，驗證零 regression（87 files, 1585 tests passed）

**Checkpoint**: ProgramScaffold 可獨立呼叫並回傳正確的 ScaffoldResult

---

## Phase 4: User Story 3 - Scaffold 驅動的程式碼產生 (Priority: P3)

**Goal**: Program generator 消費 ProgramScaffold 結果產生完整程式碼（含 boilerplate），行為與重構前一致

**Independent Test**: 端到端產出的程式碼包含 #include、using namespace、int main()、return 0；現有 roundtrip 測試全部通過

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T017 [US3] 撰寫 scaffold-codegen 整合測試（hello world 完整程式碼驗證、多 header 排序驗證）in tests/integration/scaffold-codegen.test.ts

### Implementation for User Story 3

- [X] T018 [US3] 擴展 GeneratorContext：新增 ProgramScaffold 欄位 + 全域 setter in src/core/projection/code-generator.ts
- [X] T019 [US3] 重構 program generator：消費 ProgramScaffold 產出 boilerplate（imports + preamble + entryPoint 在前，epilogue 在後）in src/languages/cpp/core/generators/statements.ts
- [X] T020 [US3] 接線 CppScaffold 到 app.ts 初始化流程 in src/ui/app.ts
- [X] T021 [US3] 執行完整測試套件 + 驗證 roundtrip 測試通過（88 files, 1588 tests passed）

**Checkpoint**: 程式碼面板產出完整可編譯 C++ 程式，所有現有測試通過

---

## Phase 5: User Story 4 - Ghost Line 視覺呈現 (Priority: P4)

**Goal**: L1 認知等級下 boilerplate 以淡灰色顯示 + hover tooltip；L0 隱藏 boilerplate 行；L2 正常顯示；支援 pin 操作

**Independent Test**: 瀏覽器中切換認知等級觀察程式碼面板顯示變化

### Implementation for User Story 4

- [X] T022 [US4] 新增 ghost-line CSS 樣式（淡灰色、降低透明度）in src/ui/style.css
- [X] T023 [US4] 實作 ghost line 裝飾：根據 ScaffoldResult 的 visibility 對 Monaco 編輯器行套用 deltaDecorations in src/ui/panels/monaco-panel.ts
- [X] T024 [US4] 實作 L0 隱藏區域：使用 Monaco setHiddenAreas API 隱藏 hidden 行 in src/ui/panels/monaco-panel.ts
- [X] T025 [US4] 實作 hover tooltip：註冊 Monaco HoverProvider，對 ghost line 顯示 reason in src/ui/panels/monaco-panel.ts
- [X] T026 [US4] 將 ScaffoldResult 傳入 sync 流程：syncBlocksToCode 產出 scaffold metadata 供 Monaco panel 消費 in src/ui/sync-controller.ts
- [X] T027 [US4] 實作 pin 操作：ghost line 上的操作將項目轉為 editable in src/ui/panels/monaco-panel.ts
- [X] T028 [US4] 認知等級切換時觸發 scaffold re-render in src/ui/app.ts

**Checkpoint**: L0/L1/L2 切換時 Ghost Line 正確顯示，hover 顯示原因，pin 可用

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 最終驗證與收尾

- [X] T029 驗證 SC-002：grep src/core/dependency-resolver.ts 和 src/core/program-scaffold.ts 確認不含 languages/ import
- [ ] T030 執行 quickstart.md 瀏覽器手動驗證（L0/L1/L2 切換 + hover + pin）
- [X] T031 執行完整測試套件，確認全部通過

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 無依賴，立即開始
- **US1 (Phase 2)**: 依賴 Setup 完成
- **US2 (Phase 3)**: 依賴 US1 完成（ProgramScaffold 消費 DependencyResolver）
- **US3 (Phase 4)**: 依賴 US1 + US2 完成（program generator 消費 ProgramScaffold）
- **US4 (Phase 5)**: 依賴 US3 完成（Ghost Line 需要 scaffold 資料流通整條 pipeline）
- **Polish (Phase 6)**: 依賴所有 User Story 完成

### User Story Dependencies

- **US1 (P1)**: 獨立，無其他 story 依賴 — **MVP**
- **US2 (P2)**: 依賴 US1（使用 DependencyResolver.resolve() 產生 imports）
- **US3 (P3)**: 依賴 US1 + US2（program generator 消費 ProgramScaffold）
- **US4 (P4)**: 依賴 US3（需要 scaffold metadata 在 sync 流程中傳遞）

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Interface/type definitions before implementations
- Core module before consumer modules
- Story complete before moving to next priority

### Parallel Opportunities

- T002 + T003 可並行（US1 測試，不同檔案）
- T012 + T013 可並行（US2 測試，不同檔案）
- T022 ~ T025 中部分可並行（CSS 與 Monaco API，但都修改 monaco-panel.ts 需序列）

---

## Parallel Example: User Story 1

```bash
# 並行寫測試：
Task T002: "DependencyResolver 契約測試 in tests/unit/core/dependency-resolver.test.ts"
Task T003: "ModuleRegistry DependencyResolver 測試 in tests/unit/languages/cpp/module-registry.test.ts"

# 序列實作（有依賴鏈）：
Task T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup（記錄基線）
2. Complete Phase 2: US1（DependencyResolver 介面 + C++ 實作）
3. **STOP and VALIDATE**: 所有現有測試通過 + 核心介面無語言專用 import
4. 可獨立交付

### Incremental Delivery

1. US1 → DependencyResolver 介面就緒 → 驗證
2. US2 → ProgramScaffold 可獨立呼叫 → 驗證
3. US3 → 程式碼面板產出完整程式 → 驗證 roundtrip
4. US4 → Ghost Line 視覺呈現 → 瀏覽器手動驗證
5. 每個 story 新增價值且不破壞先前 story

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US1→US2→US3→US4 為嚴格順序依賴鏈（非並行）
- 重要：目前系統不產生 int main()，US2/US3 是新增功能而非重構
- Commit after each story completion
- Stop at any checkpoint to validate story independently
