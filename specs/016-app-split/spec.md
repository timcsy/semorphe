# Feature Specification: Phase 2 — app.ts 拆分

**Feature Branch**: `016-app-split`
**Created**: 2026-03-09
**Status**: Draft
**Input**: Phase 2: app.ts 拆分 — 把 3575 行的 god object 拆為三個獨立模組
**Architecture Reference**: `docs/architecture-evolution.md` §8 Phase 2, §9 Checklist
**Prerequisite**: Phase 1 完成（SyncController 解耦、面板 ViewHost）

## User Scenarios & Testing *(mandatory)*

### US1 — ToolboxBuilder 純資料模組抽離 (Priority: P1)

作為平台開發者，我需要將 toolbox 建構邏輯從 app.ts 抽離為獨立模組。此模組接收積木規格和認知層級，產出 toolbox 定義結構，不依賴任何 UI 框架。這讓 toolbox 產生邏輯可以在不同宿主環境（瀏覽器、VSCode Extension）中重用。

**Why this priority**: Toolbox 建構是最純粹的資料轉換邏輯，零 UI 依賴，最容易抽離且最高重用價值。作為 MVP，單獨抽出就能顯著減少 app.ts 行數。

**Independent Test**: 給定一組積木規格和認知層級，ToolboxBuilder 產出正確的 toolbox JSON 結構。完全在單元測試中驗證，不需要瀏覽器環境。

**Acceptance Scenarios**:

1. **Given** 一組積木規格和認知層級 0（初學者），**When** 呼叫 ToolboxBuilder，**Then** 產出的 toolbox 只包含該層級可用的積木分類和積木定義。
2. **Given** 認知層級從 0 切換到 2，**When** 重新呼叫 ToolboxBuilder，**Then** 產出的 toolbox 包含更多進階積木分類。
3. **Given** ToolboxBuilder 原始碼中，**When** 檢查 import 語句，**Then** 不包含任何 UI 框架（如 Blockly DOM API）的 import。
4. **Given** 現有的風格切換功能，**When** 使用者切換程式碼風格，**Then** ToolboxBuilder 根據風格過濾 toolbox 積木。

---

### US2 — BlockRegistrar 動態積木註冊模組 (Priority: P1)

作為平台開發者，我需要將所有動態積木定義（包括序列化邏輯）從 app.ts 搬到獨立模組。目前 app.ts 包含大量動態積木定義和序列化邏輯，這些都是 Blockly 框架專屬的，應與應用邏輯分離。

**Why this priority**: 與 US1 同等重要。動態積木定義佔據 app.ts 大部分行數，搬出後 app.ts 行數將大幅減少。BlockRegistrar 與 ToolboxBuilder 修改不同檔案，可平行進行。

**Independent Test**: 積木註冊後，可在 Blockly workspace 中建立積木、序列化（saveExtraState）、反序列化（loadExtraState）完成完整 roundtrip。

**Acceptance Scenarios**:

1. **Given** BlockRegistrar 已註冊所有動態積木，**When** 建立任一積木並序列化，**Then** saveExtraState 正確保存積木狀態。
2. **Given** 一個序列化的積木狀態，**When** loadExtraState 還原，**Then** 積木恢復為序列化前的狀態。
3. **Given** app.ts 原始碼中，**When** 搜尋動態積木定義，**Then** 找不到（全部搬到 BlockRegistrar）。
4. **Given** BlockRegistrar 原始碼中，**When** 搜尋 mutator 定義，**Then** 包含所有原本在 app.ts 中的 mutator。

---

### US3 — AppShell 宿主 layout 模組與 app.ts 瘦身 (Priority: P2)

作為平台開發者，我需要將 DOM layout 管理邏輯從 app.ts 抽離為獨立的 AppShell 模組。AppShell 負責建立面板容器、分割面板、底部面板等 UI 骨架。app.ts 只剩初始化膠水碼。

**Why this priority**: 依賴 US1+US2 先搬出大量程式碼後，剩餘的 layout 邏輯才容易辨識和抽離。AppShell 是最後一步，完成後 app.ts 達到 < 500 行的目標。

**Independent Test**: AppShell 能獨立建立 UI 骨架（面板容器、分割面板、工具列），不依賴同步邏輯或積木定義。

**Acceptance Scenarios**:

1. **Given** AppShell 已初始化，**When** 檢查 DOM 結構，**Then** 包含積木面板、程式碼面板、主控台面板、變數面板的容器。
2. **Given** app.ts 原始碼，**When** 計算行數，**Then** 少於 500 行。
3. **Given** 使用者在瀏覽器開啟應用，**When** 所有模組初始化完成，**Then** 雙向同步、執行、主控台 I/O 全部正常運作。

---

### Edge Cases

- ToolboxBuilder 收到空的積木規格列表時產出空 toolbox（不報錯）
- BlockRegistrar 重複註冊同一積木 ID 時覆蓋而非報錯
- AppShell 在容器元素不存在時優雅處理
- app.ts 中存在的事件監聽器和回呼函式正確遷移到對應模組
- 風格切換、層級切換在拆分後行為完全不變

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: ToolboxBuilder MUST 為純資料模組，輸入積木規格 + 認知層級 + 風格，輸出 toolbox 定義結構
- **FR-002**: ToolboxBuilder MUST 零 UI 框架依賴（不 import Blockly DOM API、不存取 document/window）
- **FR-003**: BlockRegistrar MUST 包含所有從 app.ts 搬出的動態積木定義
- **FR-004**: BlockRegistrar MUST 包含所有 saveExtraState / loadExtraState / mutator 邏輯
- **FR-005**: AppShell MUST 負責 DOM layout 建構（面板容器、分割面板、底部面板、工具列）
- **FR-006**: app.ts 重構後 MUST 少於 500 行
- **FR-007**: app.ts MUST 只包含初始化膠水碼（建立模組、接線、啟動）
- **FR-008**: 所有現有功能 MUST 不退化：blocks↔code 同步、雙向高亮、style 切換、level 切換、執行、主控台 I/O
- **FR-009**: 所有現有測試 MUST 通過，新增的模組測試 MUST 通過
- **FR-010**: 每個新模組 MUST 可獨立測試（不需要其他模組存在）

### Key Entities

- **ToolboxBuilder**: 純資料轉換器，從積木規格和認知層級產出 toolbox 定義
- **BlockRegistrar**: Blockly 專屬模組，管理動態積木註冊和序列化
- **AppShell**: 宿主 layout 管理器，建立 UI 骨架和面板容器

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: app.ts 原始碼少於 500 行（拆分前約 3575 行）
- **SC-002**: 三個新模組（ToolboxBuilder、BlockRegistrar、AppShell）各自有獨立的單元測試
- **SC-003**: ToolboxBuilder 原始碼零 UI 框架 import（grep 驗證）
- **SC-004**: app.ts 中搜尋不到動態積木定義（全部搬到 BlockRegistrar）
- **SC-005**: 現有測試全部通過，零 regression
- **SC-006**: 建構成功
- **SC-007**: 瀏覽器端所有功能不退化

## Assumptions

- ToolboxBuilder 只產出 toolbox 定義結構，不負責注入 UI 框架（注入由 app.ts 或 AppShell 完成）
- BlockRegistrar 接收 Blockly 物件引用，在呼叫時才存取 Blockly API（不是 module-level 副作用）
- AppShell 產出 DOM 容器，面板自行在容器中初始化
- app.ts 中與特定功能無關的 utility 函式（如 debounce）可留在 app.ts 或搬到共用 utils
- 高亮邏輯（block↔code highlight）暫時留在 app.ts，因為它跨多個面板且是 UI 快捷操作
