# Tasks: Concept 與 BlockDef 分離

**Input**: Design documents from `/specs/017-concept-blockdef-split/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/module-interfaces.md

**Tests**: 包含測試任務（Constitution §II TDD 要求）

**Organization**: 按 user story 分組。US1 為 P1 核心，US2 依賴 US1（需拆分後的路徑），US3 依賴 US1。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可平行執行（不同檔案、無依賴）
- **[Story]**: 所屬 user story（US1, US2, US3）
- 包含確切檔案路徑

---

## Phase 1: Setup

**Purpose**: 確認現有狀態，建立基準線

- [x] T001 確認所有現有測試通過：`npx vitest run`
- [x] T002 確認建構成功：`npm run build`
- [x] T003 記錄現有 BlockSpec 數量基準線（83 個）和 ConceptRegistry 狀態

**Checkpoint**: 基準線已建立

---

## Phase 2: Foundational

**Purpose**: 建立共用型別和 adapter 函式，供所有 user story 使用

- [x] T004 定義 `ConceptDefJSON` 和 `BlockProjectionJSON` 型別在 `src/core/types.ts`
  - `ConceptDefJSON`：conceptId、layer、level、abstractConcept、properties、children、role、annotations
  - `BlockProjectionJSON`：id、conceptId、category、level、blockDef、codeTemplate、astPattern、renderMapping
- [x] T005 實作 `mergeToBlockSpecs()` adapter 函式在 `src/core/block-spec-adapter.ts`
  - 輸入：`ConceptDefJSON[]` + `BlockProjectionJSON[]` → 輸出：`BlockSpec[]`
  - 以 conceptId 為 key 合併兩層
  - 處理 edge case：projection 無對應 concept → 保留 projection 原樣
- [x] T006 為 adapter 寫單元測試 `tests/unit/core/block-spec-adapter.test.ts`
  - 測試 1：合併後的 BlockSpec 包含 concept + blockDef 所有欄位
  - 測試 2：projection 無對應 concept → 仍產出有效 BlockSpec
  - 測試 3：合併數量等於 projection 數量

**Checkpoint**: 基礎型別和 adapter 就緒

---

## Phase 3: User Story 1 — BlockSpec JSON 兩層拆分 (Priority: P1) 🎯 MVP

**Goal**: 將 83 個 BlockSpec JSON 拆分為 concepts.json（語意層）和 block-specs.json（投影層），應用程式行為不變

**Independent Test**: 所有現有測試通過 + concepts.json 不含 blockDef + block-specs.json 不含 concept 定義細節

### Tests for User Story 1

> **NOTE: 先寫測試，確認 FAIL，再實作**

- [x] T007 [P] [US1] 建立拆分完整性測試 `tests/unit/core/concept-split-integrity.test.ts`
  - 測試 1：universal-concepts.json + cpp concepts.json 的 conceptId 數量 ≥ 83
  - 測試 2：block-specs.json（basic+advanced+special）的條目數等於原 cpp BlockSpec 數量
  - 測試 3：universal block-specs.json 的條目數等於原 universal BlockSpec 數量
  - 測試 4：每個 block-specs.json 條目的 conceptId 都存在於 concepts.json 中
  - 測試 5：concepts.json 不含 `blockDef` 欄位
  - 測試 6：block-specs.json 不含 `properties`、`children`、`role` 等 concept 語意欄位
- [x] T008 [P] [US1] 建立 ConceptRegistry 載入測試 `tests/unit/core/concept-registry-load.test.ts`
  - 測試 1：loadFromJSON 後 listAll() 回傳正確數量
  - 測試 2：get('var_declare') 回傳正確的 properties 和 children
  - 測試 3：listByLevel(0) 只回傳 L0 concepts
  - 測試 4：concept-registry.ts 不 import 'blockly'（靜態分析）

### Implementation for User Story 1

- [x] T009 [P] [US1] 撰寫拆分腳本 `scripts/split-blockspecs.ts`
  - 讀取 4 個原始 JSON（universal、basic、advanced、special）
  - 萃取 concept 欄位 → concepts.json 格式
  - 萃取 blockDef/codeTemplate/astPattern/renderMapping → block-specs.json 格式
  - 輸出到對應目錄
- [x] T010 [US1] 執行拆分腳本，產出新 JSON 檔案
  - `src/blocks/semantics/universal-concepts.json`：universal 層 concept（26 個）
  - `src/blocks/projections/blocks/universal-blocks.json`：universal 層 blockDef（26 個）
  - `src/languages/cpp/semantics/concepts.json`：C++ 層 concept（57 個）
  - `src/languages/cpp/projections/blocks/basic.json`：basic blockDef
  - `src/languages/cpp/projections/blocks/advanced.json`：advanced blockDef
  - `src/languages/cpp/projections/blocks/special.json`：special blockDef
- [x] T011 [US1] 為 ConceptRegistry 新增 `loadFromJSON()` 方法：`src/core/concept-registry.ts`
  - 接收 `ConceptDefJSON[]` 參數
  - 內部轉換為 `ConceptDef` 並呼叫 `registerOrUpdate()`
- [x] T012 [US1] 修改 `src/languages/cpp/module.ts` 使用拆分後的 JSON + adapter
  - import 新的 concepts.json 和 block-specs.json
  - 使用 `mergeToBlockSpecs()` 合併為 `BlockSpec[]`
  - 使用 `loadFromJSON()` 載入 ConceptRegistry
  - 下游引擎仍接收 `BlockSpec[]`（不修改）
  - 回傳的 `CppModuleEngines` 新增 `conceptRegistry` 欄位
- [x] T013 [US1] 更新 `src/ui/app.ts` 傳遞 conceptRegistry 到需要的地方
  - 從 `initCppModule()` 取得 conceptRegistry
  - 確保 toolbox-builder 和其他消費者可存取
- [x] T014 [US1] 驗證 US1：全套測試 + 靜態分析
  - `npx vitest run`
  - `npm run build`
  - `grep "blockDef" src/blocks/semantics/ src/languages/cpp/semantics/` → 無結果

**Checkpoint**: JSON 拆分完成，所有功能不退化

---

## Phase 4: User Story 2 — 語言套件 Manifest (Priority: P2)

**Goal**: 建立 manifest.json 驅動的語言套件載入機制

**Independent Test**: manifest.json 宣告的資源路徑與實際載入的資源一致

**Depends on**: US1（需要拆分後的檔案路徑）

### Tests for User Story 2

> **NOTE: 先寫測試，確認 FAIL，再實作**

- [x] T015 [P] [US2] 建立 manifest 載入測試 `tests/unit/languages/manifest-loading.test.ts`
  - 測試 1：manifest.json 包含必要欄位（id、name、version、provides、parser）
  - 測試 2：provides.concepts 中的路徑檔案都存在
  - 測試 3：provides.blocks 中的路徑檔案都存在
  - 測試 4：provides.templates 和 provides.liftPatterns 中的路徑檔案都存在
  - 測試 5：從 manifest 驅動載入的結果與硬編碼載入一致（BlockSpec 數量、conceptId 集合）

### Implementation for User Story 2

- [x] T016 [P] [US2] 建立 manifest.json：`src/languages/cpp/manifest.json`
  - id: "cpp", name: "C++", version: "1.0.0"
  - parser: { type: "tree-sitter", language: "cpp" }
  - provides: { concepts, blocks, templates, liftPatterns } 含正確相對路徑
- [x] T017 [US2] 定義 `LanguageManifest` 型別在 `src/core/types.ts`
- [x] T018 [US2] 建立 manifest 載入器 `src/languages/manifest-loader.ts`
  - `loadManifest(manifest: LanguageManifest)` → 回傳載入的資源
  - 解析相對路徑、載入 JSON 檔案、回傳 concepts + projections + templates + liftPatterns
- [x] T019 [US2] 修改 `src/languages/cpp/module.ts` 改用 manifest 驅動
  - import manifest.json
  - 使用 manifest-loader 載入資源
  - 移除硬編碼的 JSON import（改由 manifest provides 路徑動態決定）
- [x] T020 [US2] 驗證 US2：全套測試
  - `npx vitest run`
  - `npm run build`

**Checkpoint**: Manifest 驅動載入成功

---

## Phase 5: User Story 3 — Dummy 唯讀視圖 (Priority: P3)

**Goal**: 建立只依賴語意層的唯讀視圖，驗證 concept 與 blockDef 解耦

**Independent Test**: 視圖的 import 不含 blockly 或 projections

**Depends on**: US1（需要 ConceptRegistry 可獨立載入）

### Tests for User Story 3

> **NOTE: 先寫測試，確認 FAIL，再實作**

- [x] T021 [P] [US3] 建立視圖測試 `tests/unit/views/semantic-tree-view.test.ts`
  - 測試 1：render() 對含 var_declare 和 print 的 SemanticTree 產出包含 concept 名稱的 HTML
  - 測試 2：render() 對空 tree 產出空內容（不報錯）
  - 測試 3：靜態分析 — semantic-tree-view.ts 不 import 'blockly'
  - 測試 4：靜態分析 — semantic-tree-view.ts 不 import 'projections/' 或 'panels/'

### Implementation for User Story 3

- [x] T022 [US3] 建立 dummy 視圖 `src/views/semantic-tree-view.ts`
  - import 只來自 `src/core/`（SemanticNode、ConceptRegistry）
  - `render(root: SemanticNode): string` → 遞迴產出 HTML
  - 每個節點顯示 concept 名稱、properties、children 數量
- [x] T023 [US3] 驗證 US3：全套測試 + 靜態分析
  - `npx vitest run`
  - `grep -r "from 'blockly'\|projections\|panels/" src/views/semantic-tree-view.ts` → 無結果

**Checkpoint**: Dummy 視圖驗證解耦成功

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 最終驗證和清理

- [x] T024 更新 panel-independence 測試確認新模組獨立性：`tests/unit/ui/panel-independence.test.ts`
  - 新增：concepts.json 不含 blockDef 欄位
  - 新增：semantic-tree-view 不 import blockly
- [x] T025 執行 quickstart.md 完整驗證流程
- [x] T026 更新 `docs/architecture-evolution.md` Phase 3 checklist 為完成
- [x] T027 清理：移除拆分腳本 `scripts/split-blockspecs.ts`（一次性工具）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 無依賴 — 立即開始
- **Foundational (Phase 2)**: 依賴 Setup 完成
- **US1 (Phase 3)**: 依賴 Foundational 完成
- **US2 (Phase 4)**: 依賴 US1 完成（需拆分後的檔案路徑）
- **US3 (Phase 5)**: 依賴 US1 完成（需 ConceptRegistry 可獨立載入）
- **Polish (Phase 6)**: 依賴所有 US 完成

### User Story Dependencies

- **US1 (JSON 拆分)**: Foundational 後可開始，核心任務
- **US2 (Manifest)**: 依賴 US1（manifest 需宣告拆分後的路徑）
- **US3 (Dummy 視圖)**: 依賴 US1（需 ConceptRegistry loadFromJSON）
- **US2 和 US3 可平行**（不同檔案）

### Within Each User Story

- 測試 MUST 先寫並 FAIL
- 實作 → 修改消費端 → 驗證
- Story 完成後 commit

### Parallel Opportunities

- T007 + T008 可平行（不同測試檔案）
- T009 可與 T007/T008 平行（不同檔案）
- T015 + T021 可平行（US2 + US3 的測試，在 US1 完成後）
- T016 + T022 可平行（US2 + US3 的實作）

---

## Implementation Strategy

### MVP First (US1 Only)

1. 完成 Phase 1: Setup
2. 完成 Phase 2: Foundational（adapter 函式）
3. 完成 Phase 3: US1（JSON 拆分 + 載入邏輯更新）
4. **STOP and VALIDATE**: 全套測試 + 靜態分析
5. 核心價值已交付：concept 與 blockDef 分離

### Incremental Delivery

1. Setup → 基準線
2. Foundational → adapter 型別就緒
3. US1 (JSON 拆分) → concepts.json + block-specs.json → 測試通過
4. US2 (Manifest) → manifest 驅動載入 → 測試通過
5. US3 (Dummy 視圖) → 解耦驗證 → 測試通過
6. Polish → 最終驗證

---

## Notes

- 總計 27 個 task
- US1: 8 tasks（核心）、US2: 6 tasks（manifest）、US3: 3 tasks（視圖）
- Foundational: 3 tasks、Setup: 3 tasks、Polish: 4 tasks
- 舊 JSON 檔案在 US1 完成後可保留（給尚未遷移的 consumer）或移除（如果所有 consumer 都已切換）
- adapter 策略確保下游引擎零修改
