# Tasks: Phase 2 — app.ts 拆分

**Input**: Design documents from `/specs/016-app-split/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/module-interfaces.md

**Tests**: 包含測試任務（Constitution §II TDD 要求）

**Organization**: 按 user story 分組，US1 和 US2 為 P1 可平行，US3 為 P2 依賴前兩者。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可平行執行（不同檔案、無依賴）
- **[Story]**: 所屬 user story（US1, US2, US3）
- 包含確切檔案路徑

---

## Phase 1: Setup

**Purpose**: 確認現有程式碼狀態，準備拆分

- [x] T001 確認所有現有測試通過：`npx vitest run`
- [x] T002 確認建構成功：`npm run build`
- [x] T003 記錄 app.ts 目前行數（基準線）：`wc -l src/ui/app.ts` → 3586 行

**Checkpoint**: 基準線已建立，可開始拆分

---

## Phase 2: Foundational

**Purpose**: 無（本次無共用基礎設施需要先建立，直接進入 user story）

---

## Phase 3: User Story 1 — ToolboxBuilder 純資料模組 (Priority: P1) 🎯 MVP

**Goal**: 將 toolbox 建構邏輯從 app.ts 抽離為純資料模組，零 UI 框架依賴

**Independent Test**: 給定積木規格和認知層級，ToolboxBuilder 產出正確的 toolbox JSON 結構。完全在單元測試中驗證，不需要瀏覽器。

### Tests for User Story 1

> **NOTE: 先寫測試，確認 FAIL，再實作**

- [x] T004 [P] [US1] 建立 toolbox-builder 單元測試：`tests/unit/ui/toolbox-builder.test.ts`
  - 測試 1：給定 level 0 → 只包含 L0 積木
  - 測試 2：給定 level 2 → 包含更多進階積木
  - 測試 3：給定 ioPreference='cstdio' → cstdio 積木排在 iostream 前面
  - 測試 4：給定空積木規格 → 產出空 toolbox（不報錯）
  - 測試 5：靜態分析 — toolbox-builder.ts 不 import 'blockly'

### Implementation for User Story 1

- [x] T005 [P] [US1] 建立 ToolboxBuilder 模組：`src/ui/toolbox-builder.ts`
  - 定義 `ToolboxBuildConfig` 介面
  - 從 app.ts `buildToolbox()` (L2120-2246) 搬出邏輯
  - 將 `Blockly.Msg` 改為 `config.msgs` 參數
  - 將 `CATEGORY_COLORS` 改為 `config.categoryColors` 參數
  - 將 `isBlockAvailable`/`getBlockLevel` 保持為 import（純函式）
  - export `buildToolbox(config: ToolboxBuildConfig): object`
- [x] T006 [US1] 修改 app.ts 使用 ToolboxBuilder：`src/ui/app.ts`
  - import `buildToolbox` from `./toolbox-builder`
  - 刪除 app.ts 中的 `buildToolbox()` 方法 (L2120-2246)
  - 修改 `updateToolboxForLevel()` 呼叫新的 `buildToolbox()`
  - 所有呼叫點改為傳入 `{ blockSpecRegistry, level, ioPreference, msgs: Blockly.Msg, categoryColors: CATEGORY_COLORS }`
- [x] T007 [US1] 驗證 US1：執行全套測試 + 靜態分析
  - `npx vitest run`
  - `grep -r "from 'blockly'" src/ui/toolbox-builder.ts` → 無結果

**Checkpoint**: ToolboxBuilder 獨立運作，app.ts 減少 ~130 行

---

## Phase 4: User Story 2 — BlockRegistrar 動態積木註冊模組 (Priority: P1)

**Goal**: 將所有動態積木定義和序列化邏輯從 app.ts 搬到獨立模組

**Independent Test**: 積木註冊後可建立、序列化、反序列化完整 roundtrip

### Tests for User Story 2

> **NOTE: 先寫測試，確認 FAIL，再實作**

- [x] T008 [P] [US2] 建立 block-registrar 單元測試：`tests/unit/ui/block-registrar.test.ts`
  - 測試 1：registerAll 後 `Blockly.Blocks['u_print']` 存在
  - 測試 2：registerAll 後 `Blockly.Blocks['u_var_declare']` 有 saveExtraState/loadExtraState
  - 測試 3：重複呼叫 registerAll 不報錯（覆蓋而非報錯）
  - 測試 4：app.ts 中搜尋不到 `Blockly.Blocks[` 定義（靜態分析）
  - 測試 5：block-registrar.ts 包含所有原本在 app.ts 的 mutator 定義

### Implementation for User Story 2

- [x] T009 [P] [US2] 建立 BlockRegistrar 模組：`src/ui/block-registrar.ts`
  - 定義 `WorkspaceAccessors` 介面
  - 定義 `BlockRegistrar` class
  - 從 app.ts 搬出 `registerBlocksFromSpecs()` (L297-315)
  - 從 app.ts 搬出 `createOpenDropdown()` (L322-336)
  - 從 app.ts 搬出 `registerDynamicBlocks()` (L338-2118) — 所有動態積木定義
  - 從 app.ts 搬出 workspace option helpers (L3122-3303):
    - `getWorkspaceVarOptions()`
    - `getScanfVarOptions()`
    - `getWorkspaceArrayOptions()`
    - `getWorkspaceFuncOptions()`
  - 將 `self = this` 模式改為透過 `WorkspaceAccessors` 閉包注入
- [x] T010 [US2] 修改 app.ts 使用 BlockRegistrar：`src/ui/app.ts`
  - import `BlockRegistrar` from `./block-registrar`
  - 在 constructor 或 init() 中建立 `this.blockRegistrar = new BlockRegistrar(this.blockSpecRegistry)`
  - 呼叫 `this.blockRegistrar.registerAll({ getVarOptions, getScanfVarOptions, ... })`
  - 刪除 app.ts 中所有搬出的方法
  - 更新 app.ts 中其他使用 getWorkspaceVarOptions 等的地方（如果有）
- [x] T011 [US2] 驗證 US2：執行全套測試 + 靜態分析
  - `npx vitest run`
  - `grep "Blockly.Blocks\[" src/ui/app.ts` → 無結果
  - `npm run build` → 成功

**Checkpoint**: BlockRegistrar 獨立運作，app.ts 減少 ~1960 行

---

## Phase 5: User Story 3 — AppShell 宿主 layout 模組 (Priority: P2)

**Goal**: 將 DOM layout 管理邏輯從 app.ts 抽離為 AppShell 模組，app.ts < 500 行

**Independent Test**: AppShell 能獨立建立 UI 骨架，不依賴同步邏輯或積木定義

**Depends on**: US1 + US2（需先搬出大量程式碼後，剩餘 layout 邏輯才容易辨識）

### Tests for User Story 3

> **NOTE: 先寫測試，確認 FAIL，再實作**

- [x] T012 [P] [US3] 建立 app-shell 單元測試：`tests/unit/ui/app-shell.test.ts`
  - 測試 1：createLayout() 回傳包含所有必要容器的 elements
  - 測試 2：DOM 中包含 toolbar、main、status-bar
  - 測試 3：app-shell.ts 不 import SyncController 或任何 panel class
  - 測試 4：updateStatusBar() 正確顯示狀態資訊

### Implementation for User Story 3

- [x] T013 [P] [US3] 建立 AppShell 模組：`src/ui/app-shell.ts`
  - 定義 `AppShellConfig`、`AppShellElements`、`AppShellCallbacks` 介面
  - 從 app.ts init() 搬出 DOM 建構邏輯 (L119-234):
    - toolbar HTML 建構
    - SplitPane 建立
    - BottomPanel 容器建立
    - QuickAccessBar 建立
    - StatusBar 建立
  - 從 app.ts 搬出 `setupToolbar()` (L2484-2525)
  - 從 app.ts 搬出 selector 初始化 (L2383-2458):
    - `setupLevelSelector()`
    - `setupStyleSelector()`
    - `setupBlockStyleSelector()`
    - `setupLocaleSelector()`
  - 從 app.ts 搬出 `updateStatusBar()` (L2465-2474)
  - 從 app.ts 搬出 `exportWorkspace()`、`importWorkspace()`、`uploadCustomBlocks()` (L2527-2606)
  - 使用 callback 介面讓 app.ts 注入行為
- [x] T014 [US3] 修改 app.ts 使用 AppShell：`src/ui/app.ts`
  - import `AppShell` from `./app-shell`
  - 在 init() 中建立 `this.appShell = new AppShell(config)`
  - 呼叫 `this.appShell.createLayout()` 取得容器
  - 呼叫 `this.appShell.wireCallbacks({ onSyncBlocks: ..., onStyleChange: ..., ... })`
  - 刪除 app.ts 中所有搬出的方法和 inline DOM 建構碼
  - 確保 style conformance UI 回呼（showStyleActionBar）從 setupCodeToBlocksPipeline 移至 AppShell
- [x] T015 [US3] 精簡 app.ts 確保 < 500 行：`src/ui/app.ts`
  - 移除未使用的 imports
  - 移除搬出方法留下的空白和多餘欄位
  - 確認 `wc -l src/ui/app.ts` < 500
- [x] T016 [US3] 驗證 US3：執行全套測試 + 靜態分析 + 行數檢查
  - `npx vitest run`
  - `npm run build`
  - `wc -l src/ui/app.ts` → < 500
  - app.ts 只包含初始化膠水碼

**Checkpoint**: AppShell 獨立運作，app.ts < 500 行

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 最終驗證和品質確認

- [x] T017 更新 panel-independence 測試確認新模組獨立性：`tests/unit/ui/panel-independence.test.ts`
- [x] T018 執行 quickstart.md 完整驗證流程
- [x] T019 更新 architecture-evolution.md Phase 2 checklist 為完成：`docs/architecture-evolution.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 無依賴 — 立即開始
- **US1 + US2 (Phase 3, 4)**: 依賴 Setup 完成 — **可平行執行**
- **US3 (Phase 5)**: 依賴 US1 + US2 完成
- **Polish (Phase 6)**: 依賴所有 US 完成

### User Story Dependencies

- **US1 (ToolboxBuilder)**: Setup 後可立即開始，無其他 story 依賴
- **US2 (BlockRegistrar)**: Setup 後可立即開始，與 US1 平行
- **US3 (AppShell)**: 依賴 US1 + US2 完成（需先搬出大量程式碼）

### Within Each User Story

- 測試 MUST 先寫並 FAIL
- 實作模組 → 修改 app.ts → 驗證
- Story 完成後 commit

### Parallel Opportunities

- T004 + T008 可平行（不同測試檔案）
- T005 + T009 可平行（不同原始碼檔案）
- T012 可在 US1+US2 完成後立即開始

---

## Parallel Example: US1 + US2

```bash
# US1 和 US2 可完全平行（不同檔案）：
# Worker A:
T004 → T005 → T006 → T007  (ToolboxBuilder)

# Worker B:
T008 → T009 → T010 → T011  (BlockRegistrar)

# 兩者完成後：
T012 → T013 → T014 → T015 → T016  (AppShell)
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. 完成 Phase 1: Setup
2. 完成 Phase 3: US1 (ToolboxBuilder)
3. **STOP and VALIDATE**: 測試 + 靜態分析
4. app.ts 已減少 ~130 行

### Incremental Delivery

1. Setup → 基準線
2. US1 (ToolboxBuilder) → -130 行 → 測試通過
3. US2 (BlockRegistrar) → -1960 行 → 測試通過
4. US3 (AppShell) → -320 行 → app.ts < 500 行
5. Polish → 最終驗證

---

## Notes

- [P] tasks = 不同檔案、無依賴
- [Story] label 對應 spec.md 中的 user story
- 每個 story 可獨立完成和測試
- 每個 task 完成後 commit（Constitution §III）
- 驗證測試先 fail 再 pass（Constitution §II TDD）
