# Feature Specification: Phase 0 — 解耦基礎設施

**Feature Branch**: `014-decoupling-infra`
**Created**: 2026-03-09
**Status**: Draft
**Input**: Phase 0: 打地基（解耦基礎設施）— 建立三層解耦的基礎設施（ViewHost 介面、SemanticBus 事件系統、Annotations 機制），不改變現有功能。
**Architecture Reference**: `docs/architecture-evolution.md` §2, §3.2, §8 Phase 0, §9 Checklist

## User Scenarios & Testing *(mandatory)*

### US1 — ViewHost 介面定義 (Priority: P1)

作為平台開發者，我需要一個統一的視圖介面（ViewHost），讓所有視圖（積木、程式碼、主控台、變數）共享相同的生命週期和能力宣告契約，為後續 Phase 1 的面板解耦做準備。

**Why this priority**: ViewHost 是三層解耦模型的基礎契約，Phase 1（SyncController 解耦）和 Phase 4（VSCode Extension）都依賴此介面。

**Independent Test**: 可以在不啟動任何 UI 的情況下，用純 TypeScript 編譯驗證介面定義正確性，並透過 mock 實作確認介面可被實現。

**Acceptance Scenarios**:

1. **Given** `src/core/view-host.ts` 已建立，**When** 一個 mock class implements ViewHost，**Then** TypeScript 編譯通過且所有必要方法都有簽名。
2. **Given** ViewHost 介面已定義，**When** 檢查其 import 來源，**Then** 不包含任何 DOM API（document、window、Blockly、Monaco）。
3. **Given** ViewHost 定義了 `capabilities: ViewCapabilities`，**When** 查詢 `editable`、`needsLanguageProjection`、`consumedAnnotations` 屬性，**Then** 型別檢查通過且值可被讀取。

---

### US2 — SemanticBus 事件系統 (Priority: P1)

作為平台開發者，我需要一個事件匯流排（SemanticBus），讓核心層和視圖層能透過發布/訂閱模式通訊，取代直接 import 的耦合方式。

**Why this priority**: SemanticBus 是所有跨層通訊的唯一通道，Phase 1 的 SyncController 重構直接依賴此元件。

**Independent Test**: 可以在 Node.js（Vitest）環境下完整測試 publish/subscribe/unsubscribe，無需瀏覽器環境。

**Acceptance Scenarios**:

1. **Given** SemanticBus 已建立，**When** 訂閱 `semantic:update` 事件並發送一個事件，**Then** 訂閱者收到正確的事件資料。
2. **Given** 多個訂閱者訂閱同一事件，**When** 發送事件，**Then** 所有訂閱者都收到通知。
3. **Given** 一個訂閱者已取消訂閱，**When** 發送事件，**Then** 該訂閱者不再收到通知。
4. **Given** SemanticBus 定義了 `SemanticEvents`（核心→視圖）和 `ViewRequests`（視圖→核心），**When** 查看型別定義，**Then** 包含 `semantic:update`、`semantic:full-sync`、`edit:semantic`、`edit:code`、`edit:blocks` 等事件型別。

---

### US3 — Annotations 機制 (Priority: P2)

作為語言套件開發者，我需要在概念定義中加入語義標註（annotations），讓視圖套件能根據標註決定呈現方式，而不需要直接依賴語言套件的實作細節。

**Why this priority**: Annotations 是語言套件和視圖套件之間的解耦契約，但短期內只有 Phase 5 的 DataFlow 視圖需要消費它，因此優先級低於 ViewHost 和 SemanticBus。

**Independent Test**: 可以透過 ConceptRegistry API 查詢已註冊概念的 annotations，驗證值的正確性。

**Acceptance Scenarios**:

1. **Given** C++ 的 `for_loop` 概念已註冊並帶有 `control_flow: "loop"` 標註，**When** 呼叫 `registry.getAnnotation('for_loop', 'control_flow')`，**Then** 回傳 `"loop"`。
2. **Given** 一個概念沒有 `hardware_binding` 標註，**When** 呼叫 `registry.getAnnotation('if', 'hardware_binding')`，**Then** 回傳 `undefined`。
3. **Given** BlockSpec JSON 中的 concept 定義已擴充 annotations 欄位，**When** 載入 JSON 並註冊概念，**Then** annotations 可透過 ConceptRegistry 查詢。
4. **Given** 為 C++ 的 `for_loop`、`if`、`func_def` 加入示範 annotations，**When** 查詢這些概念的 `control_flow`、`introduces_scope`、`cognitive_level` 標註，**Then** 回傳正確的值。

---

### Edge Cases

- 註冊同一概念兩次（不同 annotations）時，後者覆蓋前者
- SemanticBus 發送事件時無訂閱者，不報錯
- ViewCapabilities 的 `consumedAnnotations` 為空陣列時，視圖仍可正常初始化
- SemanticBus 訂閱者在回呼中拋出例外，不影響其他訂閱者接收事件

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 提供 `ViewHost` 介面，包含 `viewId`、`viewType`、`capabilities`、`initialize()`、`dispose()`、`onSemanticUpdate()`、`onExecutionState()` 方法
- **FR-002**: 系統 MUST 提供 `ViewCapabilities` 型別，包含 `editable`（boolean）、`needsLanguageProjection`（boolean）、`consumedAnnotations`（string[]）屬性
- **FR-003**: 系統 MUST 提供 `SemanticBus` class，支援型別安全的 `on(event, handler)`、`off(event, handler)`、`emit(event, data)` 方法
- **FR-004**: SemanticBus MUST 定義 `SemanticEvents` 型別（核心→視圖：`semantic:update`、`semantic:full-sync`、`execution:state`、`execution:output`、`diagnostics:update`）
- **FR-005**: SemanticBus MUST 定義 `ViewRequests` 型別（視圖→核心：`edit:semantic`、`edit:code`、`edit:blocks`、`execution:run`、`execution:input`、`config:change`）
- **FR-006**: 系統 MUST 擴充 `ConceptDef` 型別，加入可選的 `annotations` 欄位（`Record<string, unknown>`）
- **FR-007**: `ConceptRegistry` MUST 提供 `getAnnotation(conceptId: string, key: string): unknown` 查詢方法
- **FR-008**: C++ 語言套件 MUST 為 `for_loop`、`if`、`func_def` 概念提供示範 annotations（`control_flow`、`introduces_scope`、`cognitive_level`）
- **FR-009**: 所有新增檔案 MUST 位於 `src/core/` 目錄下（ViewHost、SemanticBus），且零 DOM import
- **FR-010**: 所有現有功能 MUST 不受影響，現有測試 MUST 全部通過

### Key Entities

- **ViewHost**: 視圖的統一介面契約，定義生命週期和能力宣告
- **ViewCapabilities**: 視圖的能力描述，宣告是否可編輯、是否需要語言投影、消費哪些標註
- **SemanticBus**: 事件匯流排，所有跨層通訊的唯一通道
- **SemanticEvents**: 核心→視圖的推送事件型別映射
- **ViewRequests**: 視圖→核心的請求事件型別映射
- **ConceptAnnotations**: 概念的語義標註，語言套件提供、視圖套件消費

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: ViewHost 介面可被 mock class 完整實作，TypeScript 編譯零錯誤
- **SC-002**: SemanticBus 單元測試覆蓋 publish、subscribe、unsubscribe、多訂閱者、錯誤隔離，全部通過
- **SC-003**: ConceptRegistry 的 `getAnnotation()` 可查詢到 C++ 示範概念的 3 種以上標註型別
- **SC-004**: `src/core/` 目錄下所有新增檔案零 DOM import（grep 驗證）
- **SC-005**: 現有 1439+ 測試全部通過，零 regression
- **SC-006**: `npm run build` 成功，零 TypeScript 編譯錯誤

## Assumptions

- ViewHost 和 SemanticBus 在本 Phase 只定義介面和基礎實作，現有面板尚不需要 implements ViewHost（那是 Phase 1 的工作）
- SemanticBus 的瀏覽器版實作使用同步 EventEmitter 模式；postMessage 版（VSCode）在 Phase 4 實作
- Annotations 的標註 key 集合是開放的（視圖套件可自行定義需要的 key），不做 schema 驗證
- BlockSpec JSON 的 `concept` 區段新增 `annotations` 欄位，但現有 JSON 不強制要求都加上
