# Implementation Plan: Topic System（主題 × 層級樹 × 積木覆蓋）

**Branch**: `022-topic-system` | **Date**: 2026-03-11 | **Spec**: [spec.md](./spec.md)

## Summary

完全移除 `CognitiveLevel` 型別，以 Topic + LevelTree 取代所有層級過濾邏輯。實作 Topic 維度——同一語言在不同 Topic 下有不同的層級樹結構、積木可見性和積木形狀覆蓋。Topic 是純投影層概念，不影響語義層。不做向後相容。

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Blockly 12.4.1, web-tree-sitter 0.26.6, Monaco Editor, Vite
**Storage**: localStorage（瀏覽器）
**Testing**: Vitest
**Target Platform**: 瀏覽器（Vite dev server）
**Project Type**: 單頁應用（SPA）+ library
**Performance Goals**: Topic 切換 < 200ms（toolbox 重建 + canvas 重繪）
**Constraints**: 純投影層——不修改 SemanticNode、不修改 Lifter；完全移除 CognitiveLevel，不保留向後相容
**Scale/Scope**: 2+ 個 C++ Topic 定義，每個 3+ 層 2+ 分支；~52 檔案遷移

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 檢查項 | 狀態 |
|------|--------|------|
| I. 簡約優先 | 移除 CognitiveLevel 消除雙路徑，單一機制更簡單 | ✅ 通過 |
| II. TDD | 先寫測試再實作，每個 User Story 獨立可測 | ✅ 計畫中 |
| III. Git 紀律 | 每個邏輯步驟 commit | ✅ 計畫中 |
| IV. 規格文件保護 | 不修改 specs/ 和 .specify/ 的既有文件 | ✅ 通過 |
| V. 繁體中文優先 | spec/plan/tasks 皆繁體中文 | ✅ 通過 |

**Post-design re-check**: 無新增違規。移除 CognitiveLevel 符合簡約優先——單一路徑比雙路徑更簡單。

## Project Structure

### Documentation (this feature)

```text
specs/022-topic-system/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── topic-json-schema.md
│   └── topic-api.md
├── checklists/
│   └── requirements.md
└── tasks.md                    # /speckit.tasks 產生
```

### Source Code (新增、修改、刪除)

```text
src/
├── core/
│   ├── types.ts                # 改寫：移除 CognitiveLevel；新增 Topic, LevelNode, BlockOverride
│   ├── topic-registry.ts       # 新增：TopicRegistry
│   ├── level-tree.ts           # 新增：層級樹引擎（取代 cognitive-levels.ts）
│   ├── block-override.ts       # 新增：BlockOverride 合併邏輯
│   ├── cognitive-levels.ts     # 刪除或重寫：被 level-tree.ts 取代
│   ├── block-spec-registry.ts  # 改寫：移除 level 過濾，改為 Topic-based
│   ├── storage.ts              # 改寫：SavedState 移除 level，新增 topicId + enabledBranches
│   └── program-scaffold.ts     # 改寫：scaffold visibility 改由 Topic 決定
├── ui/
│   ├── toolbar/
│   │   ├── level-selector.ts       # 刪除：被 level-tree-selector.ts 取代
│   │   ├── topic-selector.ts       # 新增：Topic 選擇下拉
│   │   └── level-tree-selector.ts  # 新增：樹狀層級瀏覽器
│   ├── toolbox-builder.ts      # 改寫：移除 CognitiveLevel，改用 Topic + enabledBranches
│   ├── sync-controller.ts      # 改寫：移除 cognitiveLevel，改用 Topic
│   ├── app.ts                  # 改寫：Topic wiring
│   ├── app-shell.ts            # 改寫：移除 onLevelChange，改為 onTopicChange
│   └── layout/
│       └── status-bar.ts       # 改寫：移除 LEVEL_LABELS，改顯示 Topic + 分支
├── languages/
│   └── cpp/
│       ├── topics/
│       │   ├── cpp-beginner.json       # 新增
│       │   └── cpp-competitive.json    # 新增
│       ├── toolbox-categories.ts       # 改寫：移除 level 參數
│       ├── cpp-scaffold.ts             # 改寫：scaffold visibility 改由 Topic 決定
│       ├── core/concepts.json          # 改寫：移除 level 欄位
│       ├── core/blocks.json            # 改寫：移除 level 欄位
│       └── std/*/concepts.json         # 改寫：移除 level 欄位（11 個模組）
├── blocks/
│   ├── semantics/universal-concepts.json  # 改寫：移除 level 欄位
│   └── projections/blocks/universal-blocks.json  # 改寫：移除 level 欄位
│
vscode-ext/
├── src/extension.ts            # 改寫：移除 cognitiveLevel 設定
└── src/webview/main.ts         # 改寫：改為 Topic 訊息

tests/
├── unit/
│   ├── core/
│   │   ├── topic-registry.test.ts      # 新增
│   │   ├── level-tree.test.ts          # 新增
│   │   ├── block-override.test.ts      # 新增
│   │   └── cognitive-levels-registry.test.ts  # 刪除或重寫
│   └── ui/
│       ├── topic-toolbox.test.ts       # 新增
│       └── toolbox-builder.test.ts     # 改寫
├── integration/
│   ├── topic-switching.test.ts         # 新增
│   └── level-switching.test.ts         # 刪除或重寫
```

**Structure Decision**: 新功能模組放在 `src/core/`。`cognitive-levels.ts` 和 `level-selector.ts` 被取代刪除。所有 JSON 的 `level` 欄位移除。

## Implementation Phases

### Phase A：核心型別與資料層

**目標**: 建立 Topic 型別定義、TopicRegistry、層級樹引擎。移除 CognitiveLevel 型別。

**步驟**:
1. `src/core/types.ts` — 移除 `CognitiveLevel` 型別；從 `BlockSpec`、`ConceptDef`、`ConceptDefJSON`、`BlockProjectionJSON`、`WorkspaceState` 中移除 `level` 欄位；新增 `Topic`、`LevelNode`、`BlockOverride`、`BlockArgOverride` 型別
2. `src/core/topic-registry.ts` — 新增 TopicRegistry（register, get, getDefault, listForLanguage）
3. `src/core/level-tree.ts` — 新增 getVisibleConcepts, flattenLevelTree, resolveEnabledBranches, validateDoublingGuideline
4. 測試

**涉及檔案**: types.ts, topic-registry.ts (新), level-tree.ts (新), 測試
**驗證**: `npx tsc --noEmit` 通過（此時許多消費者會有編譯錯誤，Phase A 只確保新型別本身正確）

### Phase B：BlockOverride 合併機制

**目標**: 實作 BlockOverride 與 base BlockSpec 的合併邏輯。

**步驟**:
1. `src/core/block-override.ts` — 新增 applyBlockOverride, mergeArgs（合併 + _remove 語義）
2. 測試

**涉及檔案**: block-override.ts (新), 測試
**驗證**: 合併邏輯測試全通過（同名覆蓋、追加、_remove 刪除、renderMapping 覆蓋）

### Phase C：C++ Topic 定義 + JSON 遷移

**目標**: 定義 C++ Topic JSON；從所有 concept/block JSON 中移除 `level` 欄位。

**步驟**:
1. `src/languages/cpp/topics/cpp-beginner.json` — 將現有 L0/L1/L2 概念分配遷移為 Topic 層級樹
2. `src/languages/cpp/topics/cpp-competitive.json` — 第二個 Topic
3. 從 28 個 JSON 檔案中移除 `level` 欄位（171 個 entries）
4. 語言模組初始化載入 Topic JSON

**涉及檔案**: 2 個新 JSON + 28 個既有 JSON + 語言模組初始化
**驗證**: Topic 載入成功，倍增軟指引無 error

### Phase D：核心遷移（Registry + Scaffold + Toolbox）

**目標**: 遷移 block-spec-registry、cognitive-levels、program-scaffold、toolbox-builder 到 Topic-based。

**步驟**:
1. `src/core/block-spec-registry.ts` — 移除 `getLevel()`、`listByCategory(cat, level)` 改為 `listByCategory(cat, visibleConcepts: Set<string>)`
2. `src/core/cognitive-levels.ts` — 刪除（或重寫為 thin wrapper around level-tree.ts）
3. `src/core/program-scaffold.ts` — `ScaffoldConfig.cognitiveLevel` 改為 `topic + enabledBranches`；可見性由 Topic 層級深度決定
4. `src/languages/cpp/cpp-scaffold.ts` — 配合 scaffold 改寫
5. `src/ui/toolbox-builder.ts` — `ToolboxBuildConfig` 移除 `level`，改用 `topic + enabledBranches`
6. `src/languages/cpp/toolbox-categories.ts` — 移除 level 參數
7. 更新/重寫受影響的測試

**涉及檔案**: ~10 個核心檔案 + 測試
**驗證**: `npx tsc --noEmit` 通過，`npm test` 通過

### Phase E：UI 遷移

**目標**: 新增 Topic 選擇器 + 層級樹瀏覽器；刪除 LevelSelector；遷移 app.ts、sync-controller、status-bar。

**步驟**:
1. `src/ui/toolbar/topic-selector.ts` — 新增 Topic 下拉選擇器
2. `src/ui/toolbar/level-tree-selector.ts` — 新增樹狀層級瀏覽器（checkbox 分支啟用/停用）
3. `src/ui/toolbar/level-selector.ts` — 刪除
4. `src/ui/sync-controller.ts` — 移除 `cognitiveLevel`、`setCognitiveLevel()`、`shouldStripScaffold()`；新增 `setTopic()`、`setBranches()`
5. `src/ui/app.ts` — 移除 `currentLevel`；新增 Topic wiring
6. `src/ui/app-shell.ts` — `onLevelChange` → `onTopicChange` + `onBranchesChange`
7. `src/ui/layout/status-bar.ts` — 移除 `LEVEL_LABELS`，改顯示 Topic 名稱 + 啟用分支
8. 更新/重寫受影響的測試

**涉及檔案**: ~8 個 UI 檔案 + 測試
**驗證**: UI 可操作，Topic 切換 + 分支啟用/停用正常運作

### Phase F：超出範圍積木半透明標記

**目標**: 畫布上不在當前可見概念中的積木降低透明度並標記。

**涉及檔案**: blockly-panel.ts, sync-controller.ts
**驗證**: 停用分支後，該分支概念的積木半透明顯示

### Phase G：持久化 + VSCode 遷移

**目標**: SavedState 改寫（移除 level，新增 topicId + enabledBranches）；VSCode extension 遷移。

**步驟**:
1. `src/core/storage.ts` — SavedState 改寫
2. `vscode-ext/src/extension.ts` — 移除 `semorphe.cognitiveLevel`，改為 Topic 設定
3. `vscode-ext/src/webview/main.ts` — 改為 Topic 訊息
4. 整合測試

**涉及檔案**: storage.ts, vscode-ext/*, 測試
**驗證**: 保存/載入 Topic 狀態正常；舊 SavedState 載入時 fallback 到預設 Topic

### Phase H：最終驗證

**目標**: 確保全量測試通過，grep 確認 CognitiveLevel 完全移除。

**驗證**:
```bash
npm test                         # 全通過
npx tsc --noEmit                 # 零錯誤
grep -r "CognitiveLevel" src/    # 零結果
grep -r "cognitiveLevel" src/    # 零結果（除了可能的 git history 相關）
```
