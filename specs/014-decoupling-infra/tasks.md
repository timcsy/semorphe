# Tasks: Phase 0 — 解耦基礎設施

**Input**: Design documents from `/specs/014-decoupling-infra/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: TDD 流程（Constitution 要求），測試先於實作。

**Organization**: Tasks grouped by user story (US1: ViewHost, US2: SemanticBus, US3: Annotations)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: 確認現有程式碼狀態正確，無基礎設施需新建

- [x] T001 確認現有測試全部通過 `npm test`
- [x] T002 確認現有 build 通過 `npm run build`

---

## Phase 2: User Story 1 — ViewHost 介面定義 (Priority: P1) 🎯 MVP

**Goal**: 定義 ViewHost + ViewCapabilities 介面，讓後續 Phase 可以讓面板 implements

**Independent Test**: mock class implements ViewHost 並通過 TypeScript 編譯，Vitest 驗證型別正確性

### Tests for US1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T003 [US1] 撰寫 ViewHost mock 實作測試 in `tests/unit/core/view-host.test.ts`：mock class implements ViewHost，驗證 viewId/viewType/capabilities 可讀取、initialize/dispose/onSemanticUpdate/onExecutionState 可呼叫

### Implementation for US1

- [x] T004 [US1] 定義 ViewHost、ViewCapabilities、ViewConfig、SemanticUpdateEvent、ExecutionStateEvent 介面 in `src/core/view-host.ts`（零 DOM import）
- [x] T005 [US1] 驗證測試通過 `npm test -- tests/unit/core/view-host.test.ts`
- [x] T006 [US1] 驗證 `src/core/view-host.ts` 零 DOM import（grep 驗證）

**Checkpoint**: ViewHost 介面可被 mock 實作，TypeScript 編譯通過

---

## Phase 3: User Story 2 — SemanticBus 事件系統 (Priority: P1)

**Goal**: 建立型別安全的 EventEmitter，定義所有核心↔視圖事件型別

**Independent Test**: Vitest 中完整測試 on/off/emit、多訂閱者、錯誤隔離

### Tests for US2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T007 [US2] 撰寫 SemanticBus 測試 in `tests/unit/core/semantic-bus.test.ts`：
  - 基礎 on/emit：訂閱事件→發送→收到正確資料
  - 多訂閱者：同一事件多個 handler 都收到通知
  - off 取消訂閱：取消後不再收到事件
  - 錯誤隔離：handler 拋例外不影響其他 handler
  - 無訂閱者 emit：不報錯
  - 型別安全：SemanticEvents 和 ViewRequests 的事件 key 和 payload 型別正確

### Implementation for US2

- [x] T008 [US2] 定義 SemanticEvents 和 ViewRequests 事件型別映射 in `src/core/semantic-bus.ts`（SemanticEvents: semantic:update, semantic:full-sync, execution:state, execution:output, diagnostics:update；ViewRequests: edit:code, edit:blocks, execution:run, execution:input, config:change）
- [x] T009 [US2] 實作 SemanticBus class in `src/core/semantic-bus.ts`：型別安全的 on/off/emit，handler 錯誤用 try-catch + console.error 隔離
- [x] T010 [US2] 驗證測試通過 `npm test -- tests/unit/core/semantic-bus.test.ts`

**Checkpoint**: SemanticBus 可發布/訂閱/取消訂閱，錯誤隔離正常

---

## Phase 4: User Story 3 — Annotations 機制 (Priority: P2)

**Goal**: ConceptDef 加入 annotations 欄位，ConceptRegistry 提供查詢 API，C++ 概念加示範標註

**Independent Test**: 透過 ConceptRegistry.getAnnotation() 查詢到 for_loop 的 control_flow 標註

### Tests for US3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T011 [US3] 在 `tests/unit/core/concept-registry.test.ts` 新增 annotations 測試：
  - 註冊含 annotations 的概念 → getAnnotation 回傳正確值
  - 查詢不存在的 annotation key → 回傳 undefined
  - 重複註冊同概念（不同 annotations）→ 後者覆蓋前者
  - 查詢不存在的概念 → 回傳 undefined

### Implementation for US3

- [x] T012 [P] [US3] 擴充 ConceptDef 型別：在 `src/core/types.ts` 的 ConceptDef 加入 `annotations?: Record<string, unknown>` 欄位
- [x] T013 [US3] 擴充 ConceptRegistry：在 `src/core/concept-registry.ts` 新增 `getAnnotation(conceptId: string, key: string): unknown` 方法
- [x] T014 [US3] 驗證 annotations 測試通過 `npm test -- tests/unit/core/concept-registry.test.ts`
- [x] T015 [P] [US3] 為 `src/languages/cpp/blocks/basic.json` 的 for_loop 概念加入 annotations：`{ "control_flow": "loop", "introduces_scope": true, "cognitive_level": 1 }`
- [x] T016 [P] [US3] 為 `src/languages/cpp/blocks/basic.json` 的 if 概念加入 annotations：`{ "control_flow": "branch", "introduces_scope": true, "cognitive_level": 0 }`
- [x] T017 [P] [US3] 為 `src/languages/cpp/blocks/advanced.json` 的 func_def 概念加入 annotations：`{ "control_flow": "sequence", "introduces_scope": true, "cognitive_level": 2 }`

**Checkpoint**: annotations 可從 JSON 載入並透過 ConceptRegistry 查詢

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 全面驗證、零 regression

- [x] T018 全部測試通過 `npm test`（現有 1439+ 測試 + 新增測試）
- [x] T019 Build 成功 `npm run build`（零 TypeScript 錯誤）
- [x] T020 零 DOM import 驗證：grep document/window/Blockly/Monaco in `src/core/view-host.ts` and `src/core/semantic-bus.ts`
- [x] T021 更新 `docs/architecture-evolution.md` §9 checklist 勾選 Phase 0 已完成項目
- [x] T022 Git commit all changes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 無依賴
- **Phase 2 (US1: ViewHost)**: 依賴 Phase 1
- **Phase 3 (US2: SemanticBus)**: 依賴 Phase 1（與 US1 可平行）
- **Phase 4 (US3: Annotations)**: 依賴 Phase 1（與 US1/US2 可平行）
- **Phase 5 (Polish)**: 依賴 Phase 2-4 全部完成

### User Story Dependencies

- **US1 (ViewHost)**: 獨立，無跨 story 依賴
- **US2 (SemanticBus)**: 獨立，不依賴 ViewHost（bus 的事件型別自包含）
- **US3 (Annotations)**: 獨立，只修改 ConceptDef 和 ConceptRegistry

### Parallel Opportunities

- US1、US2、US3 的測試和實作可完全平行（不同檔案、不同模組）
- T012、T015、T016、T017 標記 [P] 可平行（不同檔案）

---

## Implementation Strategy

### MVP First (US1 Only)

1. Phase 1: Setup 確認
2. Phase 2: ViewHost 介面 → 驗證
3. **STOP**: ViewHost 可被 mock 實作 = MVP 驗證

### Full Delivery

1. Phase 1 → Phase 2 (US1) + Phase 3 (US2) + Phase 4 (US3) 平行 → Phase 5 (Polish)
2. 每個 Phase checkpoint 後 commit

---

## Notes

- 所有新增碼位於 `src/core/`，符合 Core Layer 定位
- 這是純加法變更 — 不修改任何現有程式碼的行為
- Constitution 要求 TDD：每個 US 的測試 MUST 先寫先紅再綠
- Commit 後每個 task 或相關 task group
