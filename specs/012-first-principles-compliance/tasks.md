# Tasks: First Principles Compliance

**Input**: Design documents from `/specs/012-first-principles-compliance/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: 依循 Constitution II（TDD），每個 US 包含測試任務。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: 共用型別擴展，為所有 US 提供基礎

- [X] T001 擴展 ConfidenceLevel 和 DegradationCause type 定義在 src/core/types.ts — 將 `NodeMetadata.confidence` 從 `'high' | 'inferred'` 擴展為 `'high' | 'warning' | 'inferred' | 'user_confirmed' | 'llm_suggested' | 'raw_code'`，新增 `degradationCause?: 'syntax_error' | 'unsupported' | 'nonstandard_but_valid'` 欄位

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 確保型別系統擴展後現有測試不被破壞

**⚠️ CRITICAL**: 確認 T001 的型別擴展向後相容，現有程式碼中所有 `confidence: 'high'` 和 `confidence: 'inferred'` 的使用不需修改

- [X] T002 執行 `npm test` 確認型別擴展未破壞現有測試

**Checkpoint**: 型別基礎已就緒，各 US 可獨立開始

---

## Phase 3: User Story 1 — ConceptRegistry 完備性驗證 (Priority: P1) 🎯 MVP

**Goal**: 建立可執行的驗證腳本，掃描所有概念來源，檢查每個概念的 lift/render/extract/generate 四條路徑

**Independent Test**: 執行 `npx tsx src/scripts/verify-concept-paths.ts`，輸出通過/失敗報告

### Tests for User Story 1

- [X] T003 [P] [US1] 建立驗證腳本測試檔 tests/unit/scripts/verify-concept-paths.test.ts — 測試：(1) 掃描 JSON 能正確收集概念 ID；(2) 全路徑概念回傳通過；(3) 缺少 generate path 的概念被正確報告；(4) 缺少 extract 和 generate 的概念列出兩個缺失路徑

### Implementation for User Story 1

- [X] T004 [US1] 建立驗證腳本 src/scripts/verify-concept-paths.ts — 實作：(1) 讀取 universal.json、basic.json、advanced.json、special.json、stdlib/*.json 收集 BlockSpec 概念；(2) 讀取 lift-patterns.json 收集 LiftPattern 概念；(3) 讀取 universal-templates.json 收集 UniversalTemplate 概念；(4) 用 regex 掃描 src/languages/cpp/lifters/*.ts 的 `.register()` 呼叫收集手寫 lifter 概念；(5) 用 regex 掃描 src/languages/cpp/generators/*.ts 的 `.register()` 呼叫收集手寫 generator 概念；(6) 對每個概念 ID 檢查四條路徑存在性；(7) 輸出結構化報告；(8) 缺失時 process.exit(1)
- [X] T005 [US1] 在 package.json 新增 npm script `"verify-concepts": "tsx src/scripts/verify-concept-paths.ts"` 方便執行
- [X] T006 [US1] 執行驗證腳本，修正任何被發現的缺失路徑（補齊缺少的 codeTemplate、renderMapping 或 UniversalTemplate）

**Checkpoint**: `npm run verify-concepts` 回傳 exit code 0，所有概念四條路徑完整

---

## Phase 4: User Story 2 — Confidence 與 DegradationCause 一致性 (Priority: P2)

**Goal**: lift() 產生的每個語義節點都有明確的 confidence 值，raw_code 節點帶有 degradationCause，積木視圖依原因顯示不同顏色

**Independent Test**: 用測試程式碼驗證 lift 後節點的 confidence 和 degradationCause 設定

### Tests for User Story 2

- [X] T007 [P] [US2] 建立 confidence 測試檔 tests/unit/core/confidence.test.ts — 測試：(1) 精確 pattern match → confidence: 'high'；(2) tree-sitter ERROR 節點 → raw_code + syntax_error；(3) 已知概念但寫法不匹配 → raw_code + unsupported；(4) 完全未知節點類型 → raw_code + nonstandard_but_valid；(5) 部分子節點可 lift → confidence: 'inferred'；(6) 外層 confidence 不受內層降級影響

### Implementation for User Story 2

- [X] T008 [US2] 修改 src/core/lift/lifter.ts — (1) Level 1-2 成功匹配時設定 `metadata.confidence = 'high'`；(2) Level 3 unresolved 保留 `confidence: 'inferred'`；(3) Level 4 raw_code 設定 `confidence: 'raw_code'`；(4) 新增 degradationCause 判定邏輯：檢查 AST 節點是否有 ERROR type（→ syntax_error）、檢查節點 type 是否對應 ConceptRegistry 已知概念（→ unsupported）、否則 → nonstandard_but_valid
- [X] T009 [US2] 修改 src/core/lift/lifter.ts 讓 Lifter 可接收 ConceptRegistry 參考 — 新增 `setConceptRegistry(registry: ConceptRegistry)` 方法，用於 degradationCause 查表判定（檢查 AST nodeType 是否映射到已知概念）
- [X] T010 [US2] 修改 src/languages/cpp/module.ts — 在 initCppModule 中將 ConceptRegistry 傳入 Lifter
- [X] T011 [US2] 修改 src/core/projection/block-renderer.ts — 根據 `metadata.degradationCause` 設定積木視覺樣式：syntax_error → 紅色背景 #FF6B6B、unsupported → 灰色背景 #9E9E9E、nonstandard_but_valid → 綠色邊框 #4CAF50；設定 tooltip 顯示人類可讀的降級原因說明

**Checkpoint**: 測試通過，lift() 對各類程式碼正確設定 confidence + degradationCause

---

## Phase 5: User Story 3 — 註解 Roundtrip (Priority: P2)

**Goal**: 行尾註解、獨立註解、表達式內部註解在 code→blocks→code roundtrip 後完整保留

**Independent Test**: 用包含三種註解的測試程式碼執行 roundtrip，驗證註解內容和位置保留

### Tests for User Story 3

- [X] T012 [P] [US3] 建立註解 roundtrip 測試檔 tests/unit/core/annotation-roundtrip.test.ts — 測試：(1) `x = 1; // set x` roundtrip 後行尾註解保留；(2) 獨立註解 `// section` 保留在語句之間；(3) `foo(a, /* important */ b)` 表達式內部註解保留；(4) raw_code 節點上的行尾註解仍作為 annotation 附著；(5) 兩個連續獨立註解各自為獨立節點

### Implementation for User Story 3

- [X] T013 [US3] 建立註解 lifter src/languages/cpp/lifters/comments.ts — 實作 `registerCommentLifters(lifter)` 函式：不直接註冊 'comment' 節點 handler，而是提供 utility 函式供 lifter.ts 的 liftStatementsWithContext 呼叫，在遍歷 children 時識別 comment 節點並歸類為獨立 comment 語義節點或附著到相鄰節點的 annotation
- [X] T014 [US3] 修改 src/core/lift/lifter.ts 的 liftStatementsWithContext — 在遍歷 children 時：(1) 遇到 comment 節點，檢查 startPosition.row 是否等於前一節點 endPosition.row → 是則附著為 annotation(inline)；(2) 否則建立獨立 comment 語義節點
- [X] T015 [US3] 建立註解 generator src/languages/cpp/generators/comments.ts — 實作 `registerCommentGenerators(generator)` 函式：(1) comment 概念 → `// text`；(2) 在 code-generator 的語句輸出後檢查 annotations，inline → 附加 ` // text`，before → 在子節點前加 `/* text */ `
- [X] T016 [US3] 修改 src/core/projection/code-generator.ts 或 template-generator.ts — 在 generate 語句時檢查 `node.annotations`，將 annotation 還原為程式碼註解
- [X] T017 [US3] 在 src/languages/cpp/lifters/index.ts 註冊 comment lifter，在 src/languages/cpp/generators/index.ts 註冊 comment generator

**Checkpoint**: 三種註解的 roundtrip 測試全部通過

---

## Phase 6: User Story 4 — Code Style Preset (Priority: P3)

**Goal**: 從同一棵語義樹根據不同風格 preset 生成不同格式的程式碼，風格切換不改變語義樹

**Independent Test**: 同一段積木分別以 apcs/competitive/google 生成程式碼，驗證格式差異且語義等價

### Tests for User Story 4

- [X] T018 [P] [US4] 建立風格切換測試檔 tests/integration/style-preset.test.ts — 測試：(1) apcs 風格生成 cout 輸出；(2) competitive 風格生成 printf 輸出；(3) google 風格縮排為 2 空格；(4) 風格切換後語義樹不變；(5) 自訂參數淺層覆蓋 preset（如 apcs + indent=2 → apcs 其他參數不變但縮排改為 2）

### Implementation for User Story 4

- [X] T019 [US4] 確認 src/languages/cpp/generators/io.ts 中 print/input generator 根據 GenerateContext.style.ioPreference 選擇 cout 或 printf — 若未實作則補上分支邏輯
- [X] T020 [US4] 確認 src/languages/cpp/generators/statements.ts 中 if/while/for generator 根據 style.braceStyle 決定 `{` 位置（K&R: 同行；Allman: 新行）— 若未實作則補上
- [X] T021 [US4] 確認 src/core/projection/template-generator.ts 的 generate() 根據 style.indent 設定縮排大小 — 驗證 indent_size 參數正確傳遞
- [X] T022 [US4] 確認 src/languages/cpp/generators/declarations.ts 根據 style.useNamespaceStd 和 style.headerStyle 生成對應的 include 和 namespace 語句
- [X] T023 [US4] 在 src/languages/style.ts 的 StyleManagerImpl 中新增淺層覆蓋支援 — 新增 `mergeWithPreset(presetId: StylePresetId, overrides: Partial<CodingStyle>): CodingStyle` 方法

**Checkpoint**: 三個 preset 切換測試通過，自訂覆蓋正確合併

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 全局驗證與清理

- [X] T024 執行 `npm test` 確認所有現有測試 + 新增測試全部通過（SC-005）
- [X] T025 執行 `npm run verify-concepts` 確認 0 缺失路徑（SC-001）
- [X] T026 確認驗證腳本執行時間 < 5 秒（SC-006）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 無依賴，立即開始
- **Phase 2 (Foundational)**: 依賴 Phase 1 — 確認型別擴展向後相容
- **Phase 3 (US1)**: 依賴 Phase 2 — 獨立於其他 US
- **Phase 4 (US2)**: 依賴 Phase 1（需要 ConfidenceLevel type）— 獨立於 US1/US3/US4
- **Phase 5 (US3)**: 依賴 Phase 2 — 獨立於 US1/US2/US4
- **Phase 6 (US4)**: 依賴 Phase 2 — 獨立於 US1/US2/US3
- **Phase 7 (Polish)**: 依賴所有 US 完成

### User Story Dependencies

- **US1 (P1)**: 獨立，不依賴其他 US
- **US2 (P2)**: 依賴 T001（ConfidenceLevel type），不依賴其他 US
- **US3 (P2)**: 獨立，不依賴其他 US
- **US4 (P3)**: 獨立，不依賴其他 US

### Within Each User Story

- 測試先寫並確認 FAIL
- 實作使測試通過
- Checkpoint 驗證

### Parallel Opportunities

- T003 (US1 test) 和 T007 (US2 test) 和 T012 (US3 test) 和 T018 (US4 test) 可同時撰寫
- US1 (Phase 3) 和 US2 (Phase 4) 和 US3 (Phase 5) 和 US4 (Phase 6) 在 Phase 2 完成後可平行執行
- Phase 4 中 T008+T009 和 T011 修改不同檔案，可平行

---

## Parallel Example: User Story 2

```bash
# 先寫測試（T007），確認 FAIL
# 然後平行修改：
Task T008: "修改 lifter.ts 設定 confidence + degradationCause"
Task T011: "修改 block-renderer.ts 設定積木視覺樣式"  # 不同檔案，可平行
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成 Phase 1: Setup（T001）
2. 完成 Phase 2: Foundational（T002）
3. 完成 Phase 3: US1（T003-T006）
4. **驗證**: `npm run verify-concepts` 回傳 0
5. Commit + 可交付

### Incremental Delivery

1. Setup + Foundational → 型別基礎就緒
2. US1 → 驗證腳本可用 → Commit
3. US2 → confidence + degradationCause 正確 → Commit
4. US3 → 註解 roundtrip 完整 → Commit
5. US4 → 風格切換可用 → Commit
6. Polish → 全局驗證通過 → Commit

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- 每個 US 可獨立完成和測試
- 遵循 TDD：測試先寫、確認 FAIL、實作、確認 PASS
- 每完成一個 US 即 commit
