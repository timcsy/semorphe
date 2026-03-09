# Tasks: Phase 1 — SyncController 解耦

**Input**: Design documents from `/specs/015-sync-decouple/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: TDD 流程（Constitution 要求），測試先於實作。

**Organization**: Tasks grouped by user story (US1: SyncController bus, US2: Panels ViewHost, US3: App wiring)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: 確認現有程式碼狀態正確，準備共用基礎設施

- [x] T001 確認現有測試全部通過 `npm test`
- [x] T002 確認現有 build 通過 `npm run build`
- [x] T003 擴充 `semantic:update` payload 型別 in `src/core/semantic-bus.ts`：加入 `code?: string`, `blockState?: unknown`, `source: 'blocks' | 'code'`, `mappings?: SourceMapping[]`

---

## Phase 2: User Story 1 — SyncController 透過 SemanticBus 通訊 (Priority: P1) 🎯 MVP

**Goal**: SyncController 移除面板 import，改為透過 SemanticBus 發送/接收事件

**Independent Test**: 用 mock SemanticBus 測試 SyncController，不需要任何真實面板

### Tests for US1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T004 [US1] 重寫 `tests/unit/ui/sync-controller.test.ts`：用 SemanticBus 測試 SyncController（不 mock 面板），驗證：
  - constructor 接收 `(bus, language, style)` 而非面板
  - 收到 `edit:blocks` → 發出 `semantic:update`（含 code + source='blocks'）
  - 收到 `edit:code` → 發出 `semantic:update`（含 blockState + source='code'）
  - `syncing` flag 防迴圈：syncing 中收到 edit 事件不處理
  - style exception / io conformance 回呼正常觸發

### Implementation for US1

- [x] T005 [US1] 重寫 `src/ui/sync-controller.ts`：
  - 移除 `import type { BlocklyPanel }` 和 `import type { MonacoPanel }`
  - constructor 改為 `(bus: SemanticBus, language: string, style: StylePreset)`
  - 在 constructor 中 `bus.on('edit:blocks', ...)` 和 `bus.on('edit:code', ...)`
  - `syncBlocksToCode` 邏輯改為從 edit:blocks payload 取 blocklyState → 產生 code → `bus.emit('semantic:update', { tree, code, source: 'blocks', mappings })`
  - `syncCodeToBlocks` 邏輯改為從 edit:code payload 取 code → lift → `bus.emit('semantic:update', { tree, blockState, source: 'code' })`
  - 保留 `syncing` flag、style exception、io conformance 回呼
  - 保留 `rebuildSourceMappings`、`getMappingForBlock`、`getMappingForLine` 等映射方法
- [x] T006 [US1] 驗證 SyncController 測試通過 `npm test -- tests/unit/ui/sync-controller.test.ts`
- [x] T007 [US1] 驗證 SyncController 零面板 import：`grep -r "import.*panels/" src/ui/sync-controller.ts` 為空

**Checkpoint**: SyncController 純粹透過 bus 通訊，零面板依賴

---

## Phase 3: User Story 2 — 面板實作 ViewHost 介面 (Priority: P1)

**Goal**: 四個面板 implements ViewHost，透過 bus 訂閱事件，面板之間零 import

**Independent Test**: 拔掉任一面板 import，其他面板編譯通過

### Tests for US2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T008 [US2] 撰寫 `tests/unit/ui/panel-independence.test.ts`：
  - 驗證 `src/ui/panels/blockly-panel.ts` 不 import 其他面板
  - 驗證 `src/ui/panels/monaco-panel.ts` 不 import 其他面板
  - 驗證 `src/ui/panels/console-panel.ts` 不 import 其他面板
  - 驗證 `src/ui/panels/variable-panel.ts` 不 import 其他面板
  - 驗證 `src/ui/sync-controller.ts` 不 import 任何面板

### Implementation for US2

- [x] T009 [P] [US2] 修改 `src/ui/panels/blockly-panel.ts`：
  - implements ViewHost（viewId, viewType='blockly', capabilities）
  - 接收 bus 引用，在 initialize 中 `bus.on('semantic:update', ...)` 訂閱
  - 收到 `semantic:update` 且 `source === 'code'` 時呼叫 `setState(blockState)`
  - 使用者操作觸發 onChange 時 `bus.emit('edit:blocks', { blocklyState })`
  - dispose 中 `bus.off(...)` 取消訂閱
- [x] T010 [P] [US2] 修改 `src/ui/panels/monaco-panel.ts`：
  - implements ViewHost（viewId, viewType='monaco', capabilities）
  - 接收 bus 引用，在 initialize 中 `bus.on('semantic:update', ...)` 訂閱
  - 收到 `semantic:update` 且 `source === 'blocks'` 時呼叫 `setCode(code)`
  - 使用者操作觸發 onChange 時 `bus.emit('edit:code', { code })`
  - dispose 中 `bus.off(...)` 取消訂閱
- [x] T011 [P] [US2] 修改 `src/ui/panels/console-panel.ts`：
  - implements ViewHost（viewId, viewType='console', capabilities）
  - 接收 bus 引用，在 initialize 中 `bus.on('execution:output', ...)` 訂閱
  - 收到 `execution:output` 時顯示文字
  - dispose 中 `bus.off(...)` 取消訂閱
- [x] T012 [P] [US2] 修改 `src/ui/panels/variable-panel.ts`：
  - implements ViewHost（viewId, viewType='variable', capabilities）
  - 接收 bus 引用，在 initialize 中 `bus.on('execution:state', ...)` 訂閱
  - 收到 `execution:state` 時更新變數顯示
  - dispose 中 `bus.off(...)` 取消訂閱
- [x] T013 [US2] 驗證面板獨立性測試通過 `npm test -- tests/unit/ui/panel-independence.test.ts`

**Checkpoint**: 四個面板都 implements ViewHost，透過 bus 訂閱事件，面板之間零 import

---

## Phase 4: User Story 3 — App 層事件接線重構 (Priority: P2)

**Goal**: App 層建立 SemanticBus 實例，注入面板和 SyncController，取代直接呼叫

**Independent Test**: 瀏覽器端功能不退化

### Implementation for US3

- [x] T014 [US3] 修改 `src/ui/app.ts`：
  - 建立 `SemanticBus` 實例
  - 注入 bus 到 SyncController constructor（取代直接傳面板）
  - 注入 bus 到四個面板（讓面板自行訂閱）
  - 移除 App 層對 SyncController.syncBlocksToCode / syncCodeToBlocks 的直接呼叫（改由 bus 事件驅動）
  - 保留高亮邏輯在 App 層直接調用（不走 bus）
  - 保留 style exception / io conformance UI 回呼
- [x] T015 [US3] 驗證 `npm run build` 成功（TypeScript 零錯誤）

**Checkpoint**: App 層使用 bus 接線，所有功能透過 bus 驅動

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 全面驗證、零 regression

- [x] T016 全部測試通過 `npm test`
- [x] T017 Build 成功 `npm run build`
- [x] T018 零面板 import 驗證：grep `import.*panels/` in `src/ui/sync-controller.ts`（應為空）
- [x] T019 面板零互相 import 驗證：grep 各面板檔案確認不 import 其他面板
- [x] T020 更新 `docs/architecture-evolution.md` §9 checklist 勾選 Phase 1 已完成項目
- [x] T021 Git commit all changes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 無依賴
- **Phase 2 (US1: SyncController)**: 依賴 Phase 1（需要擴充的 bus payload）
- **Phase 3 (US2: Panels ViewHost)**: 依賴 Phase 1（需要擴充的 bus payload）；與 US1 可平行
- **Phase 4 (US3: App wiring)**: 依賴 Phase 2 + Phase 3 全部完成
- **Phase 5 (Polish)**: 依賴 Phase 4 完成

### User Story Dependencies

- **US1 (SyncController)**: 依賴 T003（bus payload 擴充），不依賴 US2
- **US2 (Panels ViewHost)**: 依賴 T003（bus payload 擴充），不依賴 US1
- **US3 (App wiring)**: 依賴 US1 + US2 全部完成

### Parallel Opportunities

- US1 和 US2 可平行進行（不同檔案）
- T009、T010、T011、T012 四個面板修改可完全平行

---

## Implementation Strategy

### MVP First (US1 Only)

1. Phase 1: Setup 確認 + bus payload 擴充
2. Phase 2: SyncController 重寫 → 驗證零面板 import
3. **STOP**: SyncController 透過 bus 通訊 = MVP 驗證

### Full Delivery

1. Phase 1 → Phase 2 (US1) + Phase 3 (US2) 平行 → Phase 4 (US3) → Phase 5 (Polish)
2. 每個 Phase checkpoint 後 commit

---

## Notes

- Constitution 要求 TDD：每個 US 的測試 MUST 先寫先紅再綠
- 高亮邏輯保留在 App 層直接調用，不走 bus（research.md R4）
- Style exception 回呼保留在 SyncController，App 層直接設定（research.md R5）
- Commit 後每個 task 或相關 task group
