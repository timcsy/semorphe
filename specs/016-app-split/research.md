# Research: Phase 2 — app.ts 拆分

**Date**: 2026-03-09 | **Plan**: [plan.md](plan.md)

## 1. 動態積木的外部化可行性

### Decision
將 `registerDynamicBlocks()` 完整搬到 `BlockRegistrar`，以閉包注入 workspace accessor（取代 `self = this` 模式）。

### Rationale
- 動態積木定義佔 app.ts 1780 行（L338-2118），是最大區塊
- 積木定義依賴兩類外部資源：(a) workspace 變數選項（getWorkspaceVarOptions 等），(b) SVG 圖示常數
- SVG 圖示純常數，直接搬走
- workspace accessor 透過 `BlockRegistrar.init({ getVarOptions, getScanfVarOptions, getArrayOptions, getFuncOptions })` 注入

### Alternatives Considered
1. **保留在 app.ts，僅抽出 helper** — 不滿足 FR-003（BlockRegistrar 包含所有動態積木定義）
2. **每個積木一個檔案** — 過度模組化，違反簡約原則

## 2. Toolbox 建構的純資料化

### Decision
`ToolboxBuilder` 接收 `BlockSpecRegistry`、`CognitiveLevel`、`StylePreset`，回傳 toolbox JSON 物件。不依賴 Blockly API。

### Rationale
- `buildToolbox()` 目前使用 `Blockly.Msg` 取得翻譯字串和 `CATEGORY_COLORS`
- `Blockly.Msg` 是純 key-value 物件，可作為參數傳入（`msgs: Record<string, string>`）
- `CATEGORY_COLORS` 是常數 import，不涉及 DOM
- `isBlockAvailable` / `getBlockLevel` 是純函式，已在 `core/cognitive-levels.ts`

### Alternatives Considered
1. **保留 Blockly.Msg 直接引用** — 違反 FR-002（零 UI 框架依賴）
2. **完全不傳 msgs** — 類別名稱需要翻譯，不可行

## 3. AppShell 的職責邊界

### Decision
AppShell 負責：
- DOM 骨架建構（toolbar HTML、SplitPane、BottomPanel 容器）
- Toolbar 按鈕事件綁定（sync、undo/redo、clear、export/import）
- Selector 初始化（level、style、block-style、locale）
- Status bar 更新

AppShell **不**負責：
- 執行邏輯（handleRun/Step/Animate）→ 留在 app.ts
- 同步管線（setupCodeToBlocksPipeline）→ 留在 app.ts
- 雙向高亮（setupBidirectionalHighlight）→ 留在 app.ts

### Rationale
- 執行邏輯與 interpreter/StepController 深度耦合，強行搬出會增加複雜度
- 同步管線是 SyncController 的初始化接線，留在 app.ts 作為膠水碼合理
- 高亮邏輯跨 BlocklyPanel + MonacoPanel + SyncController，是典型的膠水碼

### Alternatives Considered
1. **全部搬到 AppShell** — AppShell 變成新的 god object
2. **抽出 ExecutionController** — 超出 spec 範圍（Phase 2 只定義三個模組）

## 4. Workspace Option Helpers 歸屬

### Decision
`getWorkspaceVarOptions()`、`getScanfVarOptions()`、`getWorkspaceArrayOptions()`、`getWorkspaceFuncOptions()` 搬到 `BlockRegistrar`。

### Rationale
- 這些 helper 被動態積木定義的 dropdown 呼叫（`self.getWorkspaceVarOptions()`）
- 搬到 BlockRegistrar 後，透過 workspace accessor 閉包取得 workspace reference
- 消除 app.ts 的 182 行程式碼

## 5. < 500 行目標可行性分析

### 搬出行數
| 模組 | 估計行數 | 來源 |
|------|---------|------|
| BlockRegistrar | ~1960 | 動態積木 + workspace helpers |
| ToolboxBuilder | ~130 | buildToolbox + updateToolboxForLevel |
| AppShell | ~320 | DOM layout + toolbar + selectors + export/import |
| **合計搬出** | **~2410** | |

### app.ts 剩餘估計
3586 - 2410 = ~1176（raw）

但搬出後：
- imports 大幅減少（從 55 行 → ~30 行）
- constructor 和 init() 變短（inline code → module calls）
- 欄位減少（selector、layout 欄位移至 AppShell）

瘦身估計：
- imports: ~25 行
- class fields + constructor: ~20 行
- init()（呼叫模組）: ~40 行
- setupCodeToBlocksPipeline(): ~100 行（部分 style conformance 回呼移至 AppShell）
- execution: ~300 行（handleRun/Step/Animate/Accelerate/Stop/displayStep）
- highlight + sync hints: ~50 行
- autoSave/restoreState: ~25 行
- diagnostics + misc: ~40 行
- dispose: ~5 行

**估計總計: ~450 行** ✅ 可行

> 關鍵：style conformance 的 UI 回呼（showStyleActionBar 呼叫）移至 AppShell，減少 ~50 行。
