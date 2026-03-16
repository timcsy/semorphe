# Tasks: 統一積木提取器架構

**Input**: Design documents from `/specs/048-unify-extractor/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Tests**: Constitution 要求 TDD，每階段都有測試。

**Organization**: 按 user story 分組，每個 story 可獨立實作與驗證。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可平行執行（不同檔案，無相依）
- **[Story]**: 所屬 user story（US1, US2...）
- 包含確切檔案路徑

---

## Phase 1: Setup

**Purpose**: 確認基線狀態，確保重構不破壞現有行為

- [x] T001 確認基線：`npm test` 全部通過，記錄測試數量
- [x] T002 確認基線：`npx tsc --noEmit` 無錯誤

**Checkpoint**: 基線綠燈

---

## Phase 2: Foundational — DynamicRule 型別定義

**Purpose**: 定義 dynamicRules 的 TypeScript 型別，為 US1 和 US2 共用的基礎

**⚠️ CRITICAL**: 型別定義是所有 story 的共用基礎

- [x] T003 在 `src/core/types.ts` 中定義 `DynamicRule` 和 `ModeExtractRule` 介面，擴充 `RenderMapping` 介面加入 `dynamicRules?: DynamicRule[]`
- [x] T004 在 `src/core/projection/common-mappings.ts` 中新增動態路徑解析工具函式（從 extraState 中用 dotpath 取值，如 `args[0].mode`）
- [x] T005 驗證：`npx tsc --noEmit` 通過

**Checkpoint**: DynamicRule 型別可用

---

## Phase 3: User Story 1 — 靜態積木走 PatternExtractor (Priority: P1) 🎯 MVP

**Goal**: BlocklyPanel 的靜態積木提取改用 PatternExtractor，與測試走同一條路徑

**Independent Test**: 修改 `common-mappings.ts` 的映射後，UI 和測試都反映修改

### Tests for User Story 1

- [x] T006 [US1] 新增測試 `tests/integration/unified-extractor.test.ts`：驗證 BlockState → PatternExtractor 能正確提取 `c_const_declare`、`c_pointer_declare`、`c_ref_declare` 等靜態積木（模擬 Blockly 序列化 JSON 輸入）

### Implementation for User Story 1

- [x] T007 [US1] 在 `src/ui/panels/blockly-panel.ts` 中加入 PatternExtractor 實例，`loadBlockSpecs` 與 BlocklyPanel 的 blockSpecRegistry 同步
- [x] T008 [US1] 修改 `blockly-panel.ts` 的 `extractBlockInner`：在 BlockExtractorRegistry 查詢之後、`generateFromTemplate` 之前，插入 PatternExtractor fallback 路徑——將 Blockly.Block 序列化為 BlockState（`{ type, id, fields, inputs, extraState }`）後交給 PatternExtractor
- [x] T009 [US1] 實作 `serializeBlockToState(block: Blockly.Block): BlockState` 工具函式：遍歷 block 的 fields、inputs、extraState 產生 PatternExtractor 需要的 JSON 格式
- [x] T010 [US1] 驗證：`npm test` 通過，UI 上 `c_const_declare` 積木的 VALUE input 能正確提取為 `initializer` children

**Checkpoint**: 靜態積木的 UI 提取與測試走同一條路徑

---

## Phase 4: User Story 2 — 動態積木用 dynamicRules (Priority: P2)

**Goal**: PatternExtractor 能根據 dynamicRules 處理動態積木的提取；PatternRenderer 能根據同一套 dynamicRules 產生動態 BlockState

### Tests for User Story 2

- [x] T011 [US2] 新增測試：驗證 PatternExtractor 的 dynamicRules 處理——重複 input pattern（模擬 func_call 的 ARG_0..N + extraState `{ argCount: 3 }`）
- [x] T012 [P] [US2] 新增測試：驗證多模式 slot pattern（模擬 scanf 的 select/compose 模式 + extraState `{ args: [{mode:'select',text:'x'},...] }`）
- [x] T013 [P] [US2] 新增測試：驗證重複 field 組 pattern（模擬 func_def 的 TYPE_0/PARAM_0..N + extraState `{ paramCount: 2 }`）
- [x] T014 [P] [US2] 新增測試：驗證 if-elseif 鏈 pattern（模擬 if + extraState `{ elseifCount: 2, hasElse: true }`）

### Implementation for User Story 2

- [x] T015 [US2] 擴充 `src/core/projection/pattern-extractor.ts` 的 `extract()` 方法：在靜態欄位/輸入處理後，讀取 `block.extraState` 並根據 spec 的 `dynamicRules` 產生動態 children
- [x] T016 [US2] 實作 dynamicRules 的五種 pattern 處理邏輯：重複 input、重複 field 組、多模式 slot、多變數宣告、if-elseif 鏈
- [x] T017 [US2] 擴充 `src/core/projection/pattern-renderer.ts` 的 `render()` 方法：讀取 SemanticNode 的動態 children 並根據 dynamicRules 產生 extraState + 動態 inputs/fields
- [x] T018 [US2] 實作 PatternRenderer 的 dynamicRules 反向處理邏輯（SemanticNode children → extraState + dynamic inputs/fields）
- [x] T019 [US2] 驗證：T011-T014 的測試全部 PASS，`npm test` 通過

**Checkpoint**: PatternExtractor 和 PatternRenderer 都能用 dynamicRules 處理動態積木

---

## Phase 5: User Story 3 — 遷移所有手寫 extractor/strategy 並刪除 (Priority: P3)

**Goal**: 所有 48 個手寫 extractor 和 12 個 renderStrategy 轉為 JSON dynamicRules，然後刪除雙重系統

### Tests for User Story 3

- [ ] T020 [US3] 新增整合測試：對所有動態積木執行 SemanticNode → render → extract → SemanticNode roundtrip，驗證概念身分和子節點結構不變

### Implementation for User Story 3

- [ ] T021 [US3] 遷移靜態 extractor（~20 個）：確認 auto-derive 正確，移除 `extractors/register.ts` 中的靜態 extractor 註冊
- [ ] T022 [US3] 遷移動態重複 input 積木的 extractor 和 strategy（func_call、print、forward_decl）：在對應 BlockSpec JSON 加入 dynamicRules，移除手寫程式碼
- [ ] T023 [US3] 遷移動態重複 field 組積木（func_def、var_declare、doc_comment）：加入 dynamicRules，移除手寫程式碼
- [ ] T024 [US3] 遷移多模式 slot 積木（scanf、printf、input）：加入 dynamicRules，移除手寫程式碼
- [ ] T025 [US3] 遷移 if-elseif 鏈積木：加入 dynamicRules，移除手寫程式碼
- [ ] T026 [US3] 遷移其他動態積木（count_loop、for_loop、do_while、ternary、array 操作等）：加入 dynamicRules 或確認 auto-derive 正確
- [ ] T027 [US3] 修改 `blockly-panel.ts`：移除 BlockExtractorRegistry 實例化和所有引用，PatternExtractor 成為唯一提取路徑
- [ ] T028 [US3] 修改 `pattern-renderer.ts`：移除 RenderStrategyRegistry 引用，dynamicRules 成為唯一動態渲染路徑
- [ ] T029 [US3] 刪除 `src/languages/cpp/extractors/register.ts`
- [ ] T030 [US3] 刪除 `src/core/registry/block-extractor-registry.ts`
- [ ] T031 [US3] 刪除 `src/languages/cpp/renderers/strategies.ts`
- [ ] T032 [US3] 刪除 `src/core/registry/render-strategy-registry.ts`
- [ ] T033 [US3] 驗證：`npm test` 全部通過（2900+ tests），`npx tsc --noEmit` 無錯誤，搜尋 `BlockExtractorRegistry` 和 `RenderStrategyRegistry` 沒有任何引用

**Checkpoint**: 雙重系統完全消除

---

## Phase 6: Polish & 最終驗證

**Purpose**: 全面驗證

- [ ] T034 執行完整測試套件：`npm test`
- [ ] T035 執行 TypeScript 編譯檢查：`npx tsc --noEmit`
- [ ] T036 在瀏覽器中測試：載入含 const/pointer/scanf/func_def/if-else 的完整程式，驗證 code↔blocks 雙向同步和執行正確
- [ ] T037 Git commit 所有變更

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 無相依——立即開始
- **Foundational (Phase 2)**: 依賴 Phase 1 完成——型別定義
- **US1 (Phase 3)**: 依賴 Phase 2 完成——**MVP**
- **US2 (Phase 4)**: 依賴 Phase 2 完成，可與 US1 平行（不同檔案）
- **US3 (Phase 5)**: 依賴 US1 + US2 都完成——遷移和刪除
- **Polish (Phase 6)**: 依賴 US3 完成

### Parallel Opportunities

- T011, T012, T013, T014（US2 的四個測試）可平行
- US1 和 US2 的實作可平行（US1 改 blockly-panel，US2 改 pattern-extractor/renderer）
- T022-T026（US3 的遷移任務）可按積木分類平行

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成 Phase 1-2: Setup + Foundational
2. 完成 Phase 3: US1（BlocklyPanel 接入 PatternExtractor）
3. **驗證**：靜態積木的 UI 提取與測試行為一致
4. 此時已解決「測試通過但 app 壞了」的核心問題

### Incremental Delivery

1. + US1 → 靜態積木統一（MVP）
2. + US2 → 動態積木可用 dynamicRules
3. + US3 → 完全清除雙重系統
4. Polish → 最終驗證

---

## Notes

- 每個遷移步驟（T021-T026）都應該逐積木驗證 roundtrip 行為不變
- if-elseif 鏈是最複雜的 pattern，可能需要特殊的遞迴 dynamicRule 設計
- Blockly.serialization.blocks.save() 的輸出格式需要確認與 BlockState 的相容性
- 遷移期間 BlockExtractorRegistry 暫時保留作為 fallback，直到所有積木遷移完成
