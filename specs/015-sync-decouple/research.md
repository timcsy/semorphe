# Research: Phase 1 — SyncController 解耦

**Feature**: [spec.md](./spec.md)
**Created**: 2026-03-09

## R1: SyncController 現有面板耦合分析

**Decision**: SyncController 透過 bus 替代直接面板引用

**Rationale**: 分析 `src/ui/sync-controller.ts`，SyncController 僅使用面板的 4 個方法：
- `blocklyPanel.extractSemanticTree()` → 將改為訂閱 `edit:blocks` 事件
- `blocklyPanel.setState(blockState)` → 將改為發送 `semantic:update` 事件（含 blockState）
- `monacoPanel.getCode()` → 將改為訂閱 `edit:code` 事件
- `monacoPanel.setCode(code)` → 將改為發送 `semantic:update` 事件（含 code）

**Alternatives considered**:
- 抽象介面方案（面板 implement 窄介面）→ 仍是直接依賴，解耦不徹底
- Mediator pattern → 本質就是 bus，但不型別安全

## R2: SemanticEvents payload 擴充需求

**Decision**: `semantic:update` payload 需攜帶 code string 和 blockState，不只是 tree

**Rationale**:
- MonacoPanel 需要 `code: string` 來更新編輯器
- BlocklyPanel 需要 `blockState: unknown` 來更新 workspace
- 不同方向的同步需要不同投影結果
- 目前 `SemanticEvents['semantic:update']` 只有 `{ tree: SemanticNode }`

**Resolution**: 擴充為 `{ tree: SemanticNode; code?: string; blockState?: unknown; source: 'blocks' | 'code' }`

## R3: 防迴圈機制在 bus 模式的可行性

**Decision**: `syncing` flag 保留在 SyncController 內部，不需要改變

**Rationale**:
- blocks→code 方向：SyncController 收到 `edit:blocks` → 設 syncing=true → 發 `semantic:update`（含 code）→ MonacoPanel 更新 → 但不會再發 `edit:code`（因為是程式化更新，不觸發 onChange）
- code→blocks 方向：同理
- 面板端需要區分「使用者操作」和「bus 驅動的更新」，避免 re-emit

## R4: 高亮機制是否走 bus

**Decision**: 雙向高亮暫時保留在 App 層直接調用

**Rationale**:
- 高亮是 UI 快捷操作（click → highlight），頻率高、延遲敏感
- 走 bus 增加不必要的間接性，且無解耦收益（高亮本來就是 App 層 UI 邏輯）
- Phase 2 拆分 App.ts 時可再評估

## R5: Style exception 回呼在 bus 模式的處理

**Decision**: Style exception 回呼保留在 SyncController，透過 bus emit 通知 UI

**Rationale**:
- `onStyleExceptions` / `onIoConformance` 是 SyncController 的核心邏輯
- App 層透過 bus 訂閱新事件（或保留直接回呼設定，因為 App 是膠水碼）
- 本次不改 style exception 流程，僅解耦面板通訊
