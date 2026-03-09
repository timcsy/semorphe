# Feature Specification: Phase 1 — SyncController 解耦

**Feature Branch**: `015-sync-decouple`
**Created**: 2026-03-09
**Status**: Draft
**Input**: Phase 1: SyncController 解耦 — SyncController 透過 SemanticBus 通訊，面板實作 ViewHost 介面
**Architecture Reference**: `docs/architecture-evolution.md` §8 Phase 1, §9 Checklist
**Prerequisite**: Phase 0 完成（ViewHost、SemanticBus、Annotations 已就位）

## User Scenarios & Testing *(mandatory)*

### US1 — SyncController 透過 SemanticBus 通訊 (Priority: P1)

作為平台開發者，我需要 SyncController 不再直接持有面板的具體引用，改為透過 SemanticBus 發送語義事件和接收視圖請求。這樣 SyncController 就變成純粹的語義協調器，不需要知道有哪些視圖存在。

**Why this priority**: 這是解耦的核心變更。SyncController 是面板之間唯一的耦合點，一旦解耦，面板就可以自由替換、新增、或移除。

**Independent Test**: 用 mock SemanticBus 測試 SyncController，不需要任何真實面板。SyncController 發送 `semantic:update` 事件，接收 `edit:code` / `edit:blocks` 請求，所有流程可在 Vitest 中驗證。

**Acceptance Scenarios**:

1. **Given** SyncController 已初始化並連接 SemanticBus，**When** blocks 端發送 `edit:blocks` 請求（含 Blockly 序列化狀態），**Then** SyncController 解析為語義樹，透過 bus 發送 `semantic:update`（含生成的程式碼和語義樹）。
2. **Given** SyncController 已初始化，**When** code 端發送 `edit:code` 請求（含原始碼字串），**Then** SyncController lift 為語義樹，透過 bus 發送 `semantic:update`（含 block state 和語義樹）。
3. **Given** SyncController 原始碼中，**When** 檢查 import 語句，**Then** 不包含 `BlocklyPanel`、`MonacoPanel` 或任何 `panels/` 路徑。

---

### US2 — 面板實作 ViewHost 介面 (Priority: P1)

作為平台開發者，我需要所有面板（BlocklyPanel、MonacoPanel、ConsolePanel、VariablePanel）都實作 ViewHost 介面，並透過 SemanticBus 訂閱事件。面板之間不互相 import。

**Why this priority**: 與 US1 同等重要——SyncController 發送的事件需要有人接收。面板實作 ViewHost 是 bus 通訊閉環的另一半。

**Independent Test**: 每個面板都可以獨立構建和測試——拔掉任一面板的 import，其他面板的編譯不受影響。

**Acceptance Scenarios**:

1. **Given** BlocklyPanel 實作 ViewHost，**When** bus 發送 `semantic:update`（含 block state），**Then** BlocklyPanel 接收事件並更新 workspace。
2. **Given** MonacoPanel 實作 ViewHost，**When** bus 發送 `semantic:update`（含程式碼字串），**Then** MonacoPanel 接收事件並更新編輯器內容。
3. **Given** ConsolePanel 實作 ViewHost，**When** bus 發送 `execution:output`，**Then** ConsolePanel 顯示輸出文字。
4. **Given** VariablePanel 實作 ViewHost，**When** bus 發送 `execution:state`，**Then** VariablePanel 更新變數顯示。
5. **Given** 任意一個面板的 import 被移除，**When** 編譯其他面板，**Then** 編譯通過且不報錯。

---

### US3 — App 層事件接線重構 (Priority: P2)

作為平台開發者，我需要 App 層（app.ts）改用 SemanticBus 來接線面板和 SyncController，取代原本直接呼叫面板方法的模式。

**Why this priority**: 依賴 US1+US2 完成後才有意義。App 是膠水碼，負責建立 bus、初始化面板、啟動 SyncController。

**Independent Test**: 瀏覽器端功能不退化——blocks→code、code→blocks 雙向同步、雙向高亮、style 切換、執行、主控台 I/O 全部正常運作。

**Acceptance Scenarios**:

1. **Given** 使用者在積木面板拖放積木，**When** 積木變更事件觸發，**Then** 程式碼面板同步更新。
2. **Given** 使用者在程式碼面板修改程式碼，**When** 程式碼變更事件觸發，**Then** 積木面板同步更新。
3. **Given** 使用者按下執行按鈕，**When** 程式輸出 "Hello"，**Then** 主控台面板顯示 "Hello"。

---

### Edge Cases

- SyncController 在面板尚未訂閱時就發送事件（bus 靜默忽略，不報錯）
- 面板 dispose 後不再接收事件（off 取消訂閱）
- 雙向同步的防迴圈機制（`syncing` flag）在 bus 模式下仍然有效
- Style 切換時 SyncController 透過 bus 通知所有面板

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: SyncController MUST 不直接 import 任何面板模組（BlocklyPanel、MonacoPanel、ConsolePanel、VariablePanel）
- **FR-002**: SyncController MUST 透過 SemanticBus 發送 `semantic:update` 事件來通知視圖更新
- **FR-003**: SyncController MUST 透過 SemanticBus 接收 `edit:code` 和 `edit:blocks` 請求來觸發同步
- **FR-004**: BlocklyPanel MUST implements ViewHost 介面，透過 bus 訂閱 `semantic:update` 事件
- **FR-005**: MonacoPanel MUST implements ViewHost 介面，透過 bus 訂閱 `semantic:update` 事件
- **FR-006**: ConsolePanel MUST implements ViewHost 介面，透過 bus 訂閱 `execution:output` 事件
- **FR-007**: VariablePanel MUST implements ViewHost 介面，透過 bus 訂閱 `execution:state` 事件
- **FR-008**: 面板之間 MUST 零 import（任何面板模組不得 import 另一個面板模組）
- **FR-009**: App 層 MUST 建立 SemanticBus 實例並注入到 SyncController 和各面板
- **FR-010**: 所有現有功能 MUST 不退化：blocks→code、code→blocks 同步、雙向高亮、style 切換、執行、主控台 I/O
- **FR-011**: 所有現有測試 MUST 通過，新增的面板獨立性測試 MUST 通過

### Key Entities

- **SyncController**: 語義協調器，只依賴 SemanticBus，不知道具體有哪些視圖
- **SemanticBus**: Phase 0 已建立的事件匯流排，本 Phase 首次在 runtime 使用
- **ViewHost**: Phase 0 已定義的視圖介面，本 Phase 由四個面板首次實作
- **SemanticUpdateEvent**: 語義樹更新事件，攜帶 tree + 可選的 code / blockState

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: SyncController 原始碼零面板 import（grep 驗證）
- **SC-002**: 四個面板都 implements ViewHost，TypeScript 編譯零錯誤
- **SC-003**: 面板獨立性：移除任一面板 import 後，其他面板編譯通過
- **SC-004**: 現有測試全部通過，零 regression
- **SC-005**: `npm run build` 成功
- **SC-006**: 瀏覽器端 blocks↔code 雙向同步、執行、主控台 I/O 功能不退化

## Assumptions

- SemanticBus 的 `semantic:update` 事件 payload 需要擴充，攜帶 code string 和 block state（不只是 tree），因為不同視圖需要不同的投影結果
- 雙向高亮（block selection → code highlight，cursor → block highlight）暫時保留在 App 層直接調用，不走 bus。高亮是 UI 快捷操作，走 bus 會增加不必要的間接性
- SyncController 的 constructor 簽名會改變：從接收 `(BlocklyPanel, MonacoPanel, ...)` 改為接收 `(SemanticBus, ...)`
- 面板的 `onChange` 回呼會改為透過 bus emit `edit:blocks` / `edit:code` 事件
