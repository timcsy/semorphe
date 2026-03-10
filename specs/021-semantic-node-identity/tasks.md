# Tasks: Semantic Node Identity（語義節點身份）

**Input**: Design documents from `/specs/021-semantic-node-identity/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/mapping-interfaces.md, research.md, quickstart.md

**Tests**: 包含測試任務（憲法 II. TDD 要求先寫測試再實作）

**Organization**: 按使用者故事分組，每個故事可獨立實作與測試

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可平行執行（不同檔案，無依賴）
- **[Story]**: 所屬使用者故事（US1, US2, US3）
- 描述包含確切檔案路徑

---

## Phase 1: Setup（型別定義）

**Purpose**: 定義 CodeMapping 和 BlockMapping 型別，作為所有後續任務的基礎

- [x] T001 在 `src/core/projection/code-generator.ts` 中將 `SourceMapping` 介面重命名為 `CodeMapping`，將 `blockId` 欄位改為 `nodeId: string`，並新增 `export interface BlockMapping { nodeId: string; blockId: string }`

---

## Phase 2: Foundational（基礎遷移）

**Purpose**: 將 code-generator 的映射產出從 blockId 遷移到 node.id，這是所有使用者故事的前提

**⚠️ CRITICAL**: US1/US2/US3 都依賴此階段完成

- [x] T002 在 `src/core/projection/code-generator.ts` 的 `generateNode()` 函式中，將 `const blockId = node.metadata?.blockId` 改為使用 `node.id`，mapping 記錄改為 `{ nodeId: node.id, startLine, endLine }`

**Checkpoint**: CodeMapping 產出改用 nodeId，編譯通過

---

## Phase 3: User Story 1 — 無渲染依賴的跨投影高亮 (Priority: P1) 🎯 MVP

**Goal**: 程式碼映射在程式碼生成時即建立（使用 node.id），不再依賴 Blockly 渲染分配 blockId

**Independent Test**: 從語義樹生成程式碼，驗證 CodeMapping 使用 nodeId 產出且非空，無需任何積木渲染步驟

### Tests for User Story 1

> **NOTE: 先寫測試，確認測試 FAIL，再實作**

- [x] T003 [P] [US1] 在 `tests/integration/source-mapping.test.ts` 新增測試：`generateCodeWithMapping(tree)` 產出的 mappings 每筆包含 `nodeId`（等於 `node.id`）、`startLine`、`endLine`，不包含 `blockId` 欄位
- [x] T004 [P] [US1] 在 `tests/integration/source-mapping.test.ts` 新增測試：從 lifter 產出的語義樹（無 metadata.blockId）生成程式碼，mappings 非空且每筆 nodeId 有效

### Implementation for User Story 1

- [x] T005 [US1] 確認 `src/core/projection/code-generator.ts` 中 `generateNode()` 對所有具有 `id` 的節點都記錄 CodeMapping（移除原本 `if (blockId)` 的條件判斷，改為 `if (node.id)`）
- [x] T006 [US1] 更新 `tests/unit/types.test.ts` 中引用 `SourceMapping` 的測試，改為使用 `CodeMapping` 和 `nodeId`

**Checkpoint**: 從任意語義樹生成程式碼即可產出有效 CodeMapping，不依賴 Blockly

---

## Phase 4: User Story 2 — 解耦的投影映射 (Priority: P2)

**Goal**: 積木渲染產出獨立的 BlockMapping（nodeId→blockId），跨投影查詢改用 nodeId join

**Independent Test**: 驗證 CodeMapping 不含 blockId，BlockMapping 不含行號；跨投影查詢透過 nodeId join 正確運作

### Tests for User Story 2

> **NOTE: 先寫測試，確認測試 FAIL，再實作**

- [x] T007 [P] [US2] 在 `tests/unit/ui/sync-controller.test.ts` 新增測試：`renderToBlocklyState(tree)` 回傳值包含 `blockMappings: BlockMapping[]`（透過 sync-controller 的 getBlockMappings 驗證）
- [x] T008 [P] [US2] 在 `tests/unit/ui/sync-controller.test.ts` 新增測試：`getMappingForBlock(blockId)` 透過 blockId→BlockMapping→nodeId→CodeMapping 路徑查詢，回傳正確的 `{ startLine, endLine }`
- [x] T009 [P] [US2] 在 `tests/unit/ui/sync-controller.test.ts` 新增測試：`getMappingForLine(line)` 透過 line→CodeMapping→nodeId→BlockMapping 路徑查詢，回傳正確的 `{ blockId }`

### Implementation for User Story 2

- [x] T010 [US2] 修改 `src/core/projection/block-renderer.ts` 的 `renderToBlocklyState()` 函式，在分配 blockId 時同步記錄 `{ nodeId: node.id, blockId }` 到 blockMappings 陣列，並將 blockMappings 加入回傳值
- [x] T011 [US2] 重構 `src/ui/sync-controller.ts`：新增 `codeMappings: CodeMapping[]` 和 `blockMappings: BlockMapping[]` 屬性，取代現有的 `sourceMappings: SourceMapping[]`
- [x] T012 [US2] 重構 `src/ui/sync-controller.ts` 的 `getMappingForBlock(blockId)` 方法：改為 blockId→blockMappings.find→nodeId→codeMappings.find 的 join 查詢
- [x] T013 [US2] 重構 `src/ui/sync-controller.ts` 的 `getMappingForLine(line)` 方法：改為 line→codeMappings.find(range)→nodeId→blockMappings.find 的 join 查詢
- [x] T014 [US2] 更新 `src/ui/sync-controller.ts` 中所有更新映射的路徑（`handleEditBlocks`、`handleEditCode`、`resyncForLevel`、`applySemanticConversions`），改為分別維護 codeMappings 和 blockMappings
- [x] T015 [US2] 確認 `src/ui/app.ts` 中的高亮處理邏輯：block→code 使用 `getMappingForBlock`，code→block 使用 `getMappingForLine`（介面不變，內部查詢路徑已改）
- [x] T016 [US2] 移除 `src/ui/app.ts` 中對 `rebuildSourceMappings()` 的呼叫（FR-008），方法標記 @deprecated
- [x] T017 [US2] 更新 `tests/unit/ui/sync-controller.test.ts` 中新增 FR-001 驗證測試（codeMappings 不含 blockId）
- [x] T018 [US2] 更新 `tests/integration/source-mapping.test.ts` 中的端對端映射測試，改用 CodeMapping + nodeId 驗證

**Checkpoint**: 兩個映射表完全解耦——CodeMapping 無 blockId，BlockMapping 無行號；跨投影查詢透過 nodeId join

---

## Phase 5: User Story 3 — Round-Trip 中的穩定節點身份 (Priority: P3)

**Goal**: 驗證 blocks→code→blocks round-trip 中語義節點 ID 的穩定性（best-effort）

**Independent Test**: 執行 round-trip，驗證相同邏輯結構的節點保持一致的 ID 映射

### Tests for User Story 3

- [x] T019 [P] [US3] 在 `tests/integration/source-mapping.test.ts` 新增測試：驗證 round-trip 後 CodeMapping 中的 nodeId 都是有效的非空字串
- [x] T020 [P] [US3] 在 `tests/integration/source-mapping.test.ts` 新增測試：驗證 `createNode()` 產出的節點都具有有效的 `node.id`（非空字串，node_ 前綴）

### Implementation for User Story 3

- [x] T021 [US3] 驗證 `src/ui/panels/blockly-panel.ts` 的 `extractSemanticTree()` 使用 `createNode()` 自動分配 `id`（已確認，無需修改）

**Checkpoint**: Round-trip 穩定性已驗證，為 SemanticDiff（Phase 8.2）鋪路

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 全面驗證、清理與最終確認

- [x] T022 清理 `src/ui/sync-controller.ts` 中舊的 `SourceMapping` import（已移除）；`code-generator.ts` 保留 `SourceMapping` 作為 deprecated type alias 供向後相容
- [x] T023 全域搜尋 `SourceMapping` 引用，確認 src/ 中僅剩 deprecated alias 定義
- [x] T024 執行 `npx vitest run` 確認所有 1608 個測試通過（SC-003: 無回歸）
- [x] T025 驗證情境 1-4 透過整合測試覆蓋（source-mapping.test.ts 中的 4+2 個測試）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 無依賴，可立即開始
- **Foundational (Phase 2)**: 依賴 Phase 1 完成（T001 → T002）
- **US1 (Phase 3)**: 依賴 Phase 2 完成
- **US2 (Phase 4)**: 依賴 Phase 3 完成（US1 的 CodeMapping 是 US2 join 查詢的前提）
- **US3 (Phase 5)**: 依賴 Phase 4 完成（需要完整的 CodeMapping + BlockMapping 基礎設施）
- **Polish (Phase 6)**: 依賴所有 US 完成

### User Story Dependencies

- **US1 (P1)**: Phase 2 完成後可開始，不依賴其他 US
- **US2 (P2)**: 依賴 US1（需要 CodeMapping 已用 nodeId），因為 join 查詢需要兩端映射都已遷移
- **US3 (P3)**: 依賴 US2（需要完整的 CodeMapping + BlockMapping 基礎設施）

### Within Each User Story

- 測試先寫並確認 FAIL
- 實作後確認測試 PASS
- 每個邏輯步驟 commit

### Parallel Opportunities

- T003, T004 可平行（同檔案但不同測試案例）
- T007, T008, T009 可平行（不同檔案的測試）
- T019, T020 可平行（不同測試案例）

---

## Parallel Example: User Story 2

```bash
# 測試可平行（3 個不同焦點的測試）:
Task T007: "BlockMapping 型別測試 in tests/unit/core/code-generator-mapping.test.ts"
Task T008: "getMappingForBlock join 查詢 in tests/unit/ui/sync-controller.test.ts"
Task T009: "getMappingForLine join 查詢 in tests/unit/ui/sync-controller.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: 型別定義（T001）
2. Complete Phase 2: 基礎遷移（T002）
3. Complete Phase 3: US1 — CodeMapping 用 nodeId（T003-T006）
4. **STOP and VALIDATE**: 從語義樹生成程式碼，驗證 mapping 使用 nodeId 且非空
5. 此時 code mapping 已解耦，但跨投影查詢尚未遷移

### Incremental Delivery

1. Setup + Foundational → 型別就緒
2. US1 → CodeMapping 用 nodeId → 驗證（MVP!）
3. US2 → BlockMapping + join 查詢 + 移除 workaround → 驗證
4. US3 → Round-trip 穩定性驗證 → 驗證
5. Polish → 全面清理與最終確認

---

## Notes

- [P] tasks = 不同檔案或無依賴，可平行執行
- [Story] label 對應 spec.md 中的使用者故事
- 憲法 II. TDD：每個 US 的測試必須先寫並 FAIL
- 憲法 III. Git 紀律：每個邏輯步驟 commit
- 總計 25 個任務，預估影響 7 個原始碼檔案 + 3 個測試檔案
