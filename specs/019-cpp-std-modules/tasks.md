# Tasks: C++ Std Modules Reorganization

**Input**: Design documents from `/specs/019-cpp-std-modules/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Tests**: 使用 TDD — 現有測試保留，新增模組結構測試。每個遷移步驟後執行 `npm test` 驗證無退化。

**Organization**: 任務按遷移階段和 user story 組織，確保每步可獨立驗證。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup（建立骨架）

**Purpose**: 建立新的目錄結構和型別定義，不改動現有程式碼

- [x] T001 建立 `src/languages/cpp/std/` 目錄和 StdModule 介面定義在 `src/languages/cpp/std/types.ts`
- [x] T002 建立 ModuleRegistry 類別在 `src/languages/cpp/std/module-registry.ts`，含 `getHeaderForConcept()`、`getRequiredHeaders()`、`getAllModules()` 方法
- [x] T003 建立 std 聚合器骨架在 `src/languages/cpp/std/index.ts`（初始匯出空的 `allStdModules` 陣列）
- [x] T004 建立 `src/languages/cpp/core/` 目錄結構：`core/generators/`、`core/lifters/`、`core/index.ts`（初始為空殼 re-export）
- [x] T005 新增模組結構測試在 `tests/unit/languages/cpp/std/module-registry.test.ts`，驗證 StdModule 介面和 ModuleRegistry 基本功能
- [x] T006 執行 `npm test` 驗證骨架建立未破壞現有功能

---

## Phase 2: Foundational（Core 模組遷移）

**Purpose**: 將不依賴 `#include` 的語言核心搬入 `core/`，這是所有後續 std 遷移的前提

**⚠️ CRITICAL**: 此階段完成前不可開始 std 模組遷移

- [x] T007 從 `src/languages/cpp/semantics/concepts.json` 提取核心概念（if, while_loop, count_loop, for_loop, cpp_for_loop, cpp_do_while, cpp_switch, cpp_case, cpp_default, break, continue, var_declare, var_assign, var_ref, number_literal, string_literal, cpp_char_literal, arithmetic, compare, logic, cpp_increment, cpp_compound_assign, cpp_bitwise_not, cpp_ternary, cpp_cast, func_def, forward_decl, func_call_expr, array_declare, array_access, array_assign, cpp_pointer_assign, cpp_pointer_deref, cpp_address_of, cpp_include, cpp_include_local, using_declaration）寫入 `src/languages/cpp/core/concepts.json`
- [x] T008 從 `src/languages/cpp/projections/blocks/basic.json`、`advanced.json`、`special.json` 提取核心積木投影寫入 `src/languages/cpp/core/blocks.json`（排除 iostream/cstdio/stdlib 相關積木）
- [x] T009 搬移 `src/languages/cpp/generators/statements.ts` 到 `src/languages/cpp/core/generators/statements.ts`（保留原檔案為 re-export 以維持向後相容）
- [x] T010 搬移 `src/languages/cpp/generators/declarations.ts` 到 `src/languages/cpp/core/generators/declarations.ts`（保留原檔案為 re-export）
- [x] T011 搬移 `src/languages/cpp/generators/expressions.ts` 到 `src/languages/cpp/core/generators/expressions.ts`（保留原檔案為 re-export）
- [x] T012 建立 `src/languages/cpp/core/generators/index.ts` 聚合所有 core generators，匯出 `registerCoreGenerators()`
- [x] T013 搬移 `src/languages/cpp/lifters/statements.ts` 到 `src/languages/cpp/core/lifters/statements.ts`（保留原檔案為 re-export）
- [x] T014 搬移 `src/languages/cpp/lifters/declarations.ts` 到 `src/languages/cpp/core/lifters/declarations.ts`（保留原檔案為 re-export）
- [x] T015 搬移 `src/languages/cpp/lifters/expressions.ts` 到 `src/languages/cpp/core/lifters/expressions.ts`（暫時保留 cout/cin chain 偵測邏輯，稍後遷移到 iostream）
- [x] T016 [P] 搬移 `src/languages/cpp/lifters/strategies.ts` 到 `src/languages/cpp/core/lifters/strategies.ts`（保留原檔案為 re-export）
- [x] T017 [P] 搬移 `src/languages/cpp/lifters/transforms.ts` 到 `src/languages/cpp/core/lifters/transforms.ts`（保留原檔案為 re-export）
- [x] T018 建立 `src/languages/cpp/core/lifters/index.ts` 聚合所有 core lifters，匯出 `registerCoreLifters()`
- [x] T019 更新 `src/languages/cpp/core/index.ts` 匯出 coreConcepts、coreBlocks、registerCoreGenerators、registerCoreLifters
- [x] T020 執行 `npm test` 驗證 core 遷移未破壞現有功能（所有 1507+ 測試通過）

**Checkpoint**: Core 模組就位，舊檔案透過 re-export 保持相容

---

## Phase 3: User Story 1 + User Story 2 — 目錄重構 + 無退化（Priority: P1）🎯 MVP

**Goal**: 將標準函式庫積木按 header 遷移到 `std/` 目錄，同時確保所有現有功能不受影響

**Independent Test**: `npm test` 全部通過 + 瀏覽器和 VSCode 手動驗證

### iostream 模組

- [x] T021 [US2] 從現有 JSON 提取 iostream 相關概念寫入 `src/languages/cpp/std/iostream/concepts.json`（print, input, endl 的 C++ 特定概念，若全用 universal 則為空陣列）
- [x] T022 [US2] 從現有 JSON 提取 iostream 相關積木投影寫入 `src/languages/cpp/std/iostream/blocks.json`（u_print, u_input 的 iostream 特定投影）
- [x] T023 [US2] 從 `src/languages/cpp/generators/io.ts` 提取 cout/cin/endl 生成邏輯到 `src/languages/cpp/std/iostream/generators.ts`，匯出符合 StdModule 的 `registerGenerators` 函式
- [x] T024 [US2] 從 `src/languages/cpp/core/lifters/expressions.ts` 提取 cout/cin chain 偵測邏輯到 `src/languages/cpp/std/iostream/lifters.ts`，匯出符合 StdModule 的 `registerLifters` 函式

### cstdio 模組

- [x] T025 [US2] 從現有 JSON 提取 cpp_printf、cpp_scanf 概念寫入 `src/languages/cpp/std/cstdio/concepts.json`
- [x] T026 [US2] 從現有 JSON 提取 c_printf、c_scanf 積木投影寫入 `src/languages/cpp/std/cstdio/blocks.json`
- [x] T027 [US2] 從 `src/languages/cpp/generators/io.ts` 提取 printf/scanf 生成邏輯到 `src/languages/cpp/std/cstdio/generators.ts`
- [x] T028 [US2] 從 `src/languages/cpp/lifters/io.ts` 提取 printf/scanf extraction 到 `src/languages/cpp/std/cstdio/lifters.ts`

### vector 模組

- [x] T029 [P] [US2] 從 `src/languages/cpp/projections/blocks/stdlib-containers.json` 和 `src/languages/cpp/semantics/concepts.json` 提取 vector 相關定義到 `src/languages/cpp/std/vector/`（concepts.json + blocks.json + generators.ts + lifters.ts）

### algorithm 模組

- [x] T030 [P] [US2] 從 `src/languages/cpp/projections/blocks/stdlib-algorithms.json` 和 `src/languages/cpp/semantics/concepts.json` 提取 algorithm 相關定義到 `src/languages/cpp/std/algorithm/`（concepts.json + blocks.json + generators.ts + lifters.ts）

### string 模組

- [x] T031 [P] [US2] 從現有 JSON 和 generators 提取 string 相關定義到 `src/languages/cpp/std/string/`（concepts.json + blocks.json + generators.ts + lifters.ts）

### cmath 模組

- [x] T032 [P] [US2] 從現有 JSON 和 generators 提取 cmath 相關定義到 `src/languages/cpp/std/cmath/`（concepts.json + blocks.json + generators.ts + lifters.ts）

### 聚合與整合

- [x] T033 [US2] 更新 `src/languages/cpp/std/index.ts` 匯入所有 std 模組並匯出 `allStdModules: StdModule[]`
- [x] T034 [US2] 在 ModuleRegistry 中註冊所有模組的概念→header 映射（更新 `src/languages/cpp/std/module-registry.ts`）
- [x] T035 [US1] 更新 `src/languages/cpp/module.ts` 改用 core/ + std/ 載入模式
- [x] T036 [US1] 更新 `src/languages/cpp/generators/index.ts` 改為從 core/ 和 std/ 聚合
- [x] T037 [US1] 更新 `src/languages/cpp/lifters/index.ts` 改為從 core/ 和 std/ 聚合
- [x] T038 [US1] 更新瀏覽器入口 `src/ui/app.ts` 的 import 路徑：改從 core/ 和 std/ 匯入概念和積木 JSON
- [x] T039 [US1] 更新 VSCode 入口 `vscode-ext/src/webview/main.ts` 的 import 路徑：改從 core/ 和 std/ 匯入概念和積木 JSON
- [x] T040 [US1] 執行 `npm test` 驗證所有測試通過（無退化）

### 清理

- [x] T041 [US2] 移除舊的 re-export 空殼，刪除已被完全遷移的舊檔案：`src/languages/cpp/projections/blocks/stdlib-containers.json`、`stdlib-algorithms.json`，清理 `basic.json`、`special.json`、`advanced.json` 中已遷移的條目
- [x] T042 [US2] 更新 `src/languages/cpp/manifest.json` 反映新的模組結構
- [x] T043 [US1] 更新現有測試中的 import 路徑（如 `tests/unit/languages/cpp/generators.test.ts` 等）
- [x] T044 [US1] 執行 `npm test` 最終驗證（全部通過 = US1+US2 完成）

**Checkpoint**: 目錄結構重組完成，所有積木按 header 組織，瀏覽器和 VSCode 功能不變

---

## Phase 4: User Story 3 — iostream/cstdio 平行模組切換（Priority: P2）

**Goal**: iostream 和 cstdio 作為平行模組，借音偵測改用模組歸屬判斷

**Independent Test**: APCS style 下 printf 觸發借音；competitive style 下 cout 觸發借音

- [x] T045 [US3] 更新 `src/languages/cpp/style-exceptions.ts`：改用 ModuleRegistry 查詢概念所屬模組，判斷是否為借音（偵測到非偏好 std 模組的概念）
- [x] T046 [US3] 確保 style preset JSON（`src/languages/cpp/styles/apcs.json` 等）的 `io_style` 欄位與模組名稱對應（iostream↔cout, cstdio↔printf）
- [x] T047 [US3] 新增測試在 `tests/unit/languages/cpp/style-exceptions.test.ts`：驗證模組化借音偵測（APCS + printf = 借音, competitive + cout = 借音）
- [x] T048 [US3] 執行 `npm test` 驗證 US3 完成

**Checkpoint**: iostream/cstdio 平行切換正常，借音偵測改用模組歸屬

---

## Phase 5: User Story 4 — Auto-include 機制（Priority: P3）

**Goal**: 根據積木所屬模組自動生成 `#include`，與手動 include 合併去重

**Independent Test**: 拖入 vector 積木 → 生成程式碼含 `#include <vector>`；手動 include 同 header 不重複

- [x] T049 [US4] 建立 `src/languages/cpp/auto-include.ts`：掃描 semantic tree 收集所有概念 ID → 透過 ModuleRegistry 查詢所需 headers → 去重排序 → 產出 `#include` 行列表
- [x] T050 [US4] 整合 auto-include 到 generator pipeline：在 program node 的 generator 中呼叫 auto-include 引擎，將結果與手動 `c_include` 積木合併去重後輸出（修改 `src/languages/cpp/generators/statements.ts` 中的 program generator）
- [x] T051 [US4] 新增測試在 `tests/unit/languages/cpp/auto-include.test.ts`：驗證 auto-include 基本功能（概念→header 映射、去重、與手動 include 合併）
- [x] T052 [US4] 新增整合測試在 `tests/integration/auto-include.test.ts`：驗證完整 semantic tree → code generation 流程中 auto-include 正確運作
- [x] T053 [US4] 執行 `npm test` 驗證 US4 完成

**Checkpoint**: Auto-include 正常運作，所有 std 模組的積木自動帶入對應 #include

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 整體驗證和清理

- [x] T054 新增模組結構一致性測試在 `tests/integration/std-module-structure.test.ts`：驗證每個 std 子目錄包含四個標準檔案、所有概念有唯一歸屬
- [x] T055 驗證瀏覽器版完整功能：`vite build` 成功，所有 1555 測試通過
- [x] T056 驗證 VSCode 版完整功能：`esbuild` bundle 成功，webview main.ts 正確引用新模組結構
- [x] T057 執行 `npm test` 最終全量驗證
- [x] T058 執行 quickstart.md 中所有 7 個驗證場景（透過 1555 測試覆蓋 + build 驗證）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 無依賴 — 立即開始
- **Foundational (Phase 2)**: 依賴 Phase 1 完成 — 阻擋所有 std 遷移
- **US1+US2 (Phase 3)**: 依賴 Phase 2（core 模組就位後才能遷移 std）
- **US3 (Phase 4)**: 依賴 Phase 3（需要 ModuleRegistry 和所有模組就位）
- **US4 (Phase 5)**: 依賴 Phase 3（需要 ModuleRegistry 的 concept→header 映射）
- **Polish (Phase 6)**: 依賴 Phase 3-5 完成

### User Story Dependencies

- **US1 + US2 (P1)**: 合併為同一 phase — 目錄重構和無退化是同一件事的兩面
- **US3 (P2)**: 依賴 US2 的模組結構完成，但不依賴 US4
- **US4 (P3)**: 依賴 US2 的 ModuleRegistry，但不依賴 US3
- **US3 和 US4 可平行執行**

### Within Phase 3 (US1+US2)

- iostream 和 cstdio 必須在 core IO 拆分後完成（有順序依賴）
- vector、algorithm、string、cmath 彼此獨立可平行 [P]
- 聚合和整合（T033-T039）依賴所有模組建立完成
- 清理（T041-T044）依賴整合完成

### Parallel Opportunities

```bash
# Phase 3 中可平行的 std 模組遷移：
T029 (vector) | T030 (algorithm) | T031 (string) | T032 (cmath)

# Phase 4 和 Phase 5 可平行：
T045-T048 (US3 借音) | T049-T053 (US4 auto-include)
```

---

## Implementation Strategy

### MVP First (Phase 1-3 = US1+US2)

1. 完成 Phase 1: Setup（建立骨架）
2. 完成 Phase 2: Foundational（core 模組遷移）
3. 完成 Phase 3: US1+US2（std 模組遷移 + 無退化驗證）
4. **STOP and VALIDATE**: `npm test` 全部通過 = MVP 完成
5. 此時系統功能完全不變，但目錄結構已按 header 組織

### Incremental Delivery

1. Setup + Foundational → 骨架就位
2. US1+US2 → 目錄重構完成（MVP）
3. US3 → 模組化借音偵測（架構改進）
4. US4 → Auto-include（新功能）
5. Polish → 最終驗證

---

## Notes

- [P] tasks = 不同檔案、無依賴
- 每個 phase 結束後必須 `npm test` 全部通過
- re-export 空殼策略：搬移檔案時先在原位置留下 re-export，確保所有現有 import 不斷裂；清理階段再統一刪除
- 概念歸屬以 data-model.md 中的映射為準
- Commit 頻率：每個 std 模組遷移完成後 commit 一次
