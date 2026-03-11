# Tasks: Topic System（主題 × 層級樹 × 積木覆蓋）

**Input**: Design documents from `/specs/022-topic-system/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: TDD — 先寫測試再實作（Constitution II）。

**Organization**: Tasks 按 User Story 分組，確保每個 Story 可獨立實作和測試。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可平行執行（不同檔案、無依賴）
- **[Story]**: 所屬 User Story（US1, US2, US3, US4）

---

## Phase 1: Setup（型別基礎）

**Purpose**: 建立 Topic 核心型別，移除 CognitiveLevel 型別定義。此時不修復消費者的編譯錯誤。

- [ ] T001 在 src/core/types.ts 中移除 CognitiveLevel 型別定義，從 BlockSpec、ConceptDef、ConceptDefJSON、BlockProjectionJSON、WorkspaceState 中移除 level 欄位
- [ ] T002 在 src/core/types.ts 中新增 Topic、LevelNode、BlockOverride、BlockArgOverride 型別定義（參照 data-model.md）

---

## Phase 2: Foundational（核心引擎 + C++ Topic 定義）

**Purpose**: 實作 TopicRegistry、LevelTree 引擎、BlockOverride 合併、C++ Topic JSON。完成後所有 User Story 才能開始。

**⚠️ CRITICAL**: 所有 User Story 都依賴此 Phase 完成。

### Tests

- [ ] T003 [P] 建立 tests/unit/core/topic-registry.test.ts — 測試 register、get、getDefault、listForLanguage、重複 ID 報錯、default 規則驗證
- [ ] T004 [P] 建立 tests/unit/core/level-tree.test.ts — 測試 getVisibleConcepts（union 語義）、flattenLevelTree、resolveEnabledBranches（祖先自動啟用）、validateDoublingGuideline（warning）、isConceptVisible
- [ ] T005 [P] 建立 tests/unit/core/block-override.test.ts — 測試 applyBlockOverride（message/tooltip/renderMapping 覆蓋）、mergeArgs（同名覆蓋、新增追加、_remove 刪除、未提及保留）

### Implementation

- [ ] T006 [P] 建立 src/core/topic-registry.ts — TopicRegistry 類別（register, get, getDefault, listForLanguage），含 ID 唯一性驗證和 default 規則驗證
- [ ] T007 [P] 建立 src/core/level-tree.ts — getVisibleConcepts, flattenLevelTree, resolveEnabledBranches, validateDoublingGuideline, isConceptVisible
- [ ] T008 [P] 建立 src/core/block-override.ts — applyBlockOverride, mergeArgs（合併 + _remove 語義）
- [ ] T009 執行 T003-T005 的測試，確認全部通過
- [ ] T010 建立 src/languages/cpp/topics/cpp-beginner.json — 將現有 L0/L1/L2 概念分配遷移為 Topic 層級樹（根 + 至少 2 分支 + 3 層深度），設定 default: true
- [ ] T011 建立 src/languages/cpp/topics/cpp-competitive.json — 第二個 Topic，重新安排概念層級順序（scanf/printf 在較早層級、陣列和排序提前）
- [ ] T012 從 28 個 JSON 檔案中移除 level 欄位：src/blocks/semantics/universal-concepts.json、src/blocks/projections/blocks/universal-blocks.json、src/languages/cpp/core/concepts.json、src/languages/cpp/core/blocks.json、src/languages/cpp/std/*/concepts.json（11 模組）、src/languages/cpp/std/*/blocks.json

**Checkpoint**: 核心引擎測試通過、C++ Topic JSON 就緒、JSON level 欄位已移除。

---

## Phase 3: User Story 1 — Topic 切換（Priority: P1）🎯 MVP

**Goal**: 使用者可在同一語言的不同 Topic 間切換，toolbox 立即更新。

**Independent Test**: 在 UI 中切換 Topic 並驗證 toolbox 內容變化。

### Tests

- [ ] T013 [P] [US1] 建立 tests/unit/ui/topic-toolbox.test.ts — 測試 buildToolbox 以 Topic + enabledBranches 過濾積木、不同 Topic 產生不同 toolbox 內容
- [ ] T014 [P] [US1] 建立 tests/integration/topic-switching.test.ts — 測試 Topic 切換後語義樹不變（SC-002）、toolbox 更新為新 Topic 的積木子集

### Implementation

- [ ] T015 [US1] 改寫 src/core/block-spec-registry.ts — 移除 getLevel()；listByCategory(category, level) 改為 listByCategory(category, visibleConcepts: Set<string>)
- [ ] T016 [US1] 刪除 src/core/cognitive-levels.ts（被 level-tree.ts 取代），刪除 tests/unit/core/cognitive-levels-registry.test.ts
- [ ] T017 [US1] 改寫 src/ui/toolbox-builder.ts — ToolboxBuildConfig 移除 level，新增 topic: Topic + enabledBranches: Set<string>；buildToolbox 使用 getVisibleConcepts 過濾
- [ ] T018 [US1] 改寫 src/languages/cpp/toolbox-categories.ts — buildIoCategoryContents 移除 level 參數，改用 visibleConcepts
- [ ] T019 [US1] 改寫 src/core/program-scaffold.ts — ScaffoldConfig 移除 cognitiveLevel，新增 topic + enabledBranches；resolveVisibility 改由 Topic 層級樹深度決定
- [ ] T020 [US1] 改寫 src/languages/cpp/cpp-scaffold.ts — 配合 scaffold 改寫
- [ ] T021 [US1] 建立 src/ui/toolbar/topic-selector.ts — Topic 下拉選擇器（顯示語言可用 Topic 列表，觸發 onTopicChange 事件）
- [ ] T022 [US1] 改寫 src/ui/sync-controller.ts — 移除 cognitiveLevel/setCognitiveLevel()/shouldStripScaffold()；新增 currentTopic/enabledBranches、setTopic()、resyncForTopic()
- [ ] T023 [US1] 改寫 src/ui/app.ts — 移除 currentLevel；新增 currentTopic/enabledBranches；wire up topic-selector；Topic 切換時觸發 buildToolbox + resync
- [ ] T024 [US1] 改寫 src/ui/app-shell.ts — AppShellCallbacks 移除 onLevelChange，新增 onTopicChange + onBranchesChange
- [ ] T025 [US1] 改寫 src/ui/layout/status-bar.ts — 移除 LEVEL_LABELS，改顯示 Topic 名稱
- [ ] T026 [US1] 在語言模組初始化中載入 Topic JSON 並註冊到 TopicRegistry（修改 src/languages/cpp/ 中的模組載入邏輯）
- [ ] T027 [US1] 改寫 tests/unit/ui/toolbox-builder.test.ts — 更新為 Topic-based API
- [ ] T028 [US1] 刪除或改寫 tests/integration/level-switching.test.ts — 更新為 Topic 切換測試
- [ ] T029 [US1] 執行 npm test && npx tsc --noEmit，確認全部通過

**Checkpoint**: Topic 切換可運作，toolbox 根據 Topic 正確過濾。

---

## Phase 4: User Story 2 — 層級樹分支展開（Priority: P1）

**Goal**: 使用者可在層級樹中啟用/停用分支，toolbox 即時更新為所有已啟用分支的概念聯集。

**Independent Test**: 操作層級樹 UI 並驗證 toolbox 隨分支啟用/停用而變化。

### Implementation

- [ ] T030 [US2] 建立 src/ui/toolbar/level-tree-selector.ts — 樹狀層級瀏覽器（根據 Topic.levelTree 渲染樹結構，checkbox 啟用/停用分支，觸發 onBranchesChange 事件）
- [ ] T031 [US2] 刪除 src/ui/toolbar/level-selector.ts（被 level-tree-selector.ts 取代）
- [ ] T032 [US2] 在 src/ui/app.ts 中 wire up level-tree-selector — 分支變更時呼叫 getVisibleConcepts 重算可見概念，觸發 buildToolbox + resync
- [ ] T033 [US2] 在 src/ui/sync-controller.ts 中新增 setBranches(branches: Set<string>) — 分支變更時重建 toolbox + 更新 canvas
- [ ] T034 [US2] 實作超出範圍積木半透明標記 — 在 src/ui/panels/blockly-panel.ts 中，根據 visibleConcepts 判斷積木是否在範圍內，超出範圍的降低 opacity 並標記
- [ ] T035 [US2] 執行 npm test && npx tsc --noEmit

**Checkpoint**: 層級樹分支啟用/停用運作，超出範圍積木半透明顯示。

---

## Phase 5: User Story 3 — BlockSpec 覆蓋（Priority: P2）

**Goal**: Topic 的 BlockOverride 讓同一概念在不同 Topic 有不同積木形狀。

**Independent Test**: 定義含 BlockOverride 的 Topic，驗證積木形狀改變。

### Implementation

- [ ] T036 [US3] 在 src/core/block-spec-registry.ts 中新增 getWithOverride(conceptId, topic?) 方法 — 按「Topic override → base BlockSpec」查找並合併
- [ ] T037 [US3] 改寫 src/core/projection/pattern-renderer.ts — loadBlockSpecs 接受 Topic 參數，在建立 RenderSpec 時合併 BlockOverride
- [ ] T038 [US3] 在 src/ui/sync-controller.ts 的 resyncForTopic() 中，Topic 切換時重新載入 PatternRenderer 的 block specs（含 override 合併）
- [ ] T039 [US3] 在 cpp-competitive.json 中為 print 概念加入 BlockOverride（message 改為 printf 風格、args 覆蓋為 FORMAT + ARG），驗證切換 Topic 後積木形狀改變
- [ ] T040 [US3] 執行 npm test && npx tsc --noEmit

**Checkpoint**: BlockOverride 生效，不同 Topic 下同一概念有不同積木形狀。

---

## Phase 6: User Story 4 — 持久化（Priority: P3）

**Goal**: Topic 選擇和分支狀態持久化到 localStorage，頁面重載後自動恢復。

**Independent Test**: 設定 Topic + 分支、重載頁面、驗證狀態恢復。

### Implementation

- [ ] T041 [US4] 改寫 src/core/storage.ts — SavedState 移除 level: CognitiveLevel，新增 topicId: string + enabledBranches: string[]
- [ ] T042 [US4] 在 src/ui/app.ts 的 save/load 邏輯中整合 Topic 狀態 — 儲存時寫入 topicId + enabledBranches，載入時恢復（找不到 Topic 時 fallback 到預設）
- [ ] T043 [US4] 處理舊 SavedState 遷移 — 載入時如果沒有 topicId 欄位，fallback 到語言的預設 Topic 並重置分支
- [ ] T044 [US4] 執行 npm test && npx tsc --noEmit

**Checkpoint**: Topic 和分支狀態持久化，頁面重載恢復正常。

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: VSCode 遷移、最終驗證、清理。

- [ ] T045 [P] 改寫 vscode-ext/src/extension.ts — 移除 semorphe.cognitiveLevel 設定，改為 Topic 相關設定
- [ ] T046 [P] 改寫 vscode-ext/src/webview/main.ts — 改為 Topic 訊息
- [ ] T047 執行 npm test 全量測試，確認 100% 通過
- [ ] T048 執行 npx tsc --noEmit，確認零型別錯誤
- [ ] T049 確認 CognitiveLevel 完全移除 — grep -r "CognitiveLevel" src/ 和 grep -r "cognitiveLevel" src/ 均為零結果
- [ ] T050 手動驗證：啟動 npm run dev，測試 Topic 切換 + 分支展開 + BlockOverride + 持久化流程

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 無依賴
- **Foundational (Phase 2)**: 依賴 Phase 1
- **US1 (Phase 3)**: 依賴 Phase 2 — BLOCKS 所有後續 Story（因為是核心遷移）
- **US2 (Phase 4)**: 依賴 Phase 3（需要 Topic 切換基礎設施）
- **US3 (Phase 5)**: 依賴 Phase 3（需要 PatternRenderer 改寫基礎）
- **US4 (Phase 6)**: 依賴 Phase 3（需要 SavedState 改寫）
- **Polish (Phase 7)**: 依賴所有 User Story

### User Story Dependencies

- **US1 (Topic 切換)**: Phase 2 完成後可開始。是其他所有 Story 的基礎。
- **US2 (層級樹分支)**: 依賴 US1 完成（需要 Topic wiring 就緒）
- **US3 (BlockOverride)**: 依賴 US1 完成（需要 registry 改寫就緒）。可與 US2 平行。
- **US4 (持久化)**: 依賴 US1 完成（需要 SavedState 改寫）。可與 US2/US3 平行。

### Within Each User Story

- Tests FIRST → 確認 FAIL → Implementation → 確認 PASS
- Core modules → UI → Integration
- 每個邏輯步驟完成後 commit

### Parallel Opportunities

- T003, T004, T005 可平行（各自獨立的測試檔案）
- T006, T007, T008 可平行（各自獨立的模組）
- T013, T014 可平行
- US3 和 US4 可平行（都只依賴 US1）
- T045, T046 可平行（VSCode extension 不同檔案）

---

## Parallel Example: Phase 2

```bash
# 先平行寫三個測試：
Task T003: "topic-registry.test.ts"
Task T004: "level-tree.test.ts"
Task T005: "block-override.test.ts"

# 再平行實作三個模組：
Task T006: "topic-registry.ts"
Task T007: "level-tree.ts"
Task T008: "block-override.ts"
```

## Parallel Example: US3 + US4

```bash
# US1 完成後，可同時開始：
Task T036-T040: "US3 BlockOverride"
Task T041-T044: "US4 持久化"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup（型別定義）
2. Complete Phase 2: Foundational（核心引擎 + Topic JSON）
3. Complete Phase 3: US1（Topic 切換 + 核心遷移）
4. **STOP and VALIDATE**: `npm test` 全通過、Topic 切換可運作
5. 此時已有可運作的 Topic 系統（只有切換，沒有分支瀏覽、override、持久化）

### Incremental Delivery

1. Phase 1 + 2 → 核心就緒
2. + US1 → Topic 切換可運作（MVP!）
3. + US2 → 層級樹分支可展開
4. + US3 → BlockOverride 生效
5. + US4 → 持久化
6. + Polish → VSCode + 最終驗證

---

## Notes

- CognitiveLevel 完全移除，不保留向後相容
- 28 個 JSON 的 level 欄位移除是批量操作（T012）
- Topic 是純投影層——語義樹、Lifter、Generator 完全不受影響
- 每個 checkpoint 後 commit
- US1 是最大的 Phase（核心遷移），後續 Story 相對輕量
