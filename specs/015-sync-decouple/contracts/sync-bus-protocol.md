# Contract: SyncController ↔ SemanticBus Protocol

**Feature**: [../spec.md](../spec.md)
**Created**: 2026-03-09

## Overview

SyncController 透過 SemanticBus 與面板通訊的完整協議。

## SyncController 訂閱的事件

### `edit:blocks` — 積木變更請求

**Publisher**: BlocklyPanel
**Payload**: `{ blocklyState: unknown }`
**SyncController 行為**:
1. 檢查 `syncing` flag，如為 true 則忽略
2. 從 blocklyState 提取語義樹
3. 用 code-generator 產生程式碼
4. 發送 `semantic:update`（含 tree + code + source='blocks'）

### `edit:code` — 程式碼變更請求

**Publisher**: MonacoPanel
**Payload**: `{ code: string }`
**SyncController 行為**:
1. 檢查 `syncing` flag，如為 true 則忽略
2. Parse code → lift 為語義樹
3. 檢測 style exceptions
4. 產生 blockState
5. 發送 `semantic:update`（含 tree + blockState + source='code'）

## SyncController 發送的事件

### `semantic:update` — 語義樹更新

**Subscriber**: BlocklyPanel, MonacoPanel
**Payload**: `{ tree: SemanticNode; code?: string; blockState?: unknown; source: 'blocks' | 'code'; mappings?: SourceMapping[] }`

**BlocklyPanel 行為**: 如果 `source === 'code'` 且 `blockState` 存在，更新 workspace
**MonacoPanel 行為**: 如果 `source === 'blocks'` 且 `code` 存在，更新編輯器

## 防迴圈保證

- SyncController 內部 `syncing` flag 防止遞迴
- 面板收到 `semantic:update` 時做程式化更新，不觸發 onChange（不 re-emit edit 事件）
- `source` 欄位讓面板可判斷是否需要處理（BlocklyPanel 忽略 source='blocks'）

## 面板生命週期

- 面板在 `initialize()` 中呼叫 `bus.on()` 訂閱事件
- 面板在 `dispose()` 中呼叫 `bus.off()` 取消訂閱
- Bus 對無訂閱者的 emit 靜默忽略
