# Research: Topic System (022-topic-system)

**Date**: 2026-03-11

## 決策紀錄

### 1. 完全取代 CognitiveLevel

**Decision**: 移除 `CognitiveLevel = 0 | 1 | 2` 型別，以 Topic + LevelTree 完全取代。不做向後相容。

**Rationale**:
- 單一路徑比雙路徑（有 Topic / 無 Topic）更簡單、更容易維護
- 消除到處判斷「有沒有 Topic」的條件分支
- 每個語言必須定義至少一個 Topic（C++ 原有的 L0/L1/L2 概念分配遷移為一個預設 Topic）
- 現有 JSON 中的 `level` 欄位移除，概念的層級歸屬完全由 Topic 的 LevelNode.concepts 決定

**Migration scope**（~52 檔案）:
- 型別定義：`types.ts` 移除 CognitiveLevel
- 核心：`cognitive-levels.ts`（重寫或刪除）、`block-spec-registry.ts`（移除 level 過濾）
- 持久化：`storage.ts`（SavedState.level → topicId + enabledBranches）
- Scaffold：`program-scaffold.ts`（visibility 改由 LevelNode 屬性決定）
- UI：`level-selector.ts`（刪除，由 level-tree-selector.ts 取代）、`toolbox-builder.ts`、`status-bar.ts`
- 同步：`sync-controller.ts`、`app.ts`、`app-shell.ts`
- VSCode：`extension.ts`、`webview/main.ts`
- 測試：9+ 個測試檔案
- JSON：28 個 block/concept JSON 檔案（171 個 level 欄位）

### 2. Scaffold 可見性如何遷移

**Decision**: Scaffold 的 hidden/ghost/editable 可見性改由 LevelNode 的屬性（或 Topic 的 scaffoldVisibility 設定）決定，而非硬編碼的 `level === 0`。

**Rationale**:
- 現有邏輯：L0 → hidden, L1 → ghost, L2 → editable
- 新邏輯：Topic 定義中指定哪些 LevelNode 啟用時 scaffold 從 hidden → ghost → editable
- 或更簡單：根節點 = hidden, 第一層子節點 = ghost, 更深 = editable
- 具體策略在 Topic JSON 中可配置

### 3. BlockOverride 的注入點

**Decision**: 在 `PatternRenderer.loadBlockSpecs()` 階段合併 Topic override，不在 render 時動態查找。

**Rationale**:
- PatternRenderer 在載入時建立 `RenderSpec` 快取，是最自然的合併點
- 避免每次 render 都做 override 查找的效能開銷
- Topic 切換時 reload block specs 即可

### 4. 層級樹 UI 形式

**Decision**: 使用可展開的樹狀控制元件取代現有 L0/L1/L2 三按鈕。

**Rationale**:
- 層級樹的分支結構天然適合樹狀展開
- 使用者需要同時啟用多個分支（checkbox 語義）

### 5. Topic 切換觸發流程

**Decision**: Topic 切換時觸發 `buildToolbox()` 重建 + `PatternRenderer` 重新載入 + canvas 重繪（標記超出範圍的積木）。不觸發語義樹重建。

**Rationale**: Topic 是純投影層，語義樹不變。只需要：
1. 重算可見概念集合
2. 重建 toolbox
3. 重新渲染 canvas（應用 BlockOverride + 標記超出範圍的積木）

### 6. JSON level 欄位處理

**Decision**: 移除所有 concept/block JSON 中的 `level` 欄位。概念的層級歸屬完全由 Topic 的 LevelNode.concepts 陣列決定。

**Rationale**:
- 避免兩個 source of truth（JSON level vs Topic LevelNode）
- Topic 是層級歸屬的唯一決定者
- 若同一概念在不同 Topic 中出現在不同層級，這正是 Topic 的設計目的
- BlockSpec 和 ConceptDef 中不再需要 `level` 欄位
