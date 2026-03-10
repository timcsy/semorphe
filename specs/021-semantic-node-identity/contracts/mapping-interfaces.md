# 介面契約：Mapping Interfaces

**功能**: 021-semantic-node-identity | **日期**: 2026-03-10

## 型別定義

### CodeMapping

```typescript
/** 語義節點 → 生成程式碼行號範圍 */
export interface CodeMapping {
  nodeId: string      // SemanticNode.id
  startLine: number   // 0-based
  endLine: number     // 0-based, inclusive
}
```

**不變量**:
- `nodeId` 非空字串
- `endLine >= startLine`
- 同一 nodeId 最多出現一次（1:1 映射）

### BlockMapping

```typescript
/** 語義節點 → Blockly 積木 */
export interface BlockMapping {
  nodeId: string      // SemanticNode.id
  blockId: string     // Blockly block ID
}
```

**不變量**:
- `nodeId` 非空字串
- `blockId` 非空字串
- 同一 nodeId 最多出現一次

## 產出契約

### `generateCodeWithMapping(tree) → { code, mappings: CodeMapping[] }`

**前置條件**: `tree` 中每個 SemanticNode 具有有效的 `id` 欄位
**後置條件**:
- 每個具有 `id` 的語義節點在 `mappings` 中有一筆對應的 CodeMapping
- `mappings` 不包含 `blockId` 欄位
- `startLine` / `endLine` 對應 `code` 中的實際行號

### `renderToBlocklyState(tree) → { blockState, blockMappings: BlockMapping[] }`

**前置條件**: `tree` 中每個 SemanticNode 具有有效的 `id` 欄位
**後置條件**:
- 每個被渲染為 Blockly 積木的節點在 `blockMappings` 中有一筆對應
- `blockMappings` 不包含行號欄位
- `blockId` 對應 `blockState` 中的積木 ID

## 消費契約

### `sync-controller.ts`

**輸入**: `codeMappings: CodeMapping[]` + `blockMappings: BlockMapping[]`

**查詢方法**:

```typescript
/** 根據 blockId 查找對應的程式碼行範圍 */
getMappingForBlock(blockId: string): { startLine: number, endLine: number } | null
// 路徑: blockId → blockMappings.find(blockId) → nodeId → codeMappings.find(nodeId)

/** 根據行號查找對應的 blockId */
getMappingForLine(line: number): { blockId: string } | null
// 路徑: line → codeMappings.find(line ∈ range) → nodeId → blockMappings.find(nodeId)
```

**不變量**:
- 查詢結果一致性：`getMappingForBlock(b).line` 與 `getMappingForLine(line).blockId` 為反向查詢
- 查詢時間 < 1ms（線性掃描，< 100 筆資料）

## 遷移契約

### 向後相容

- 舊 `SourceMapping { blockId, startLine, endLine }` 型別將被移除
- 所有引用 `SourceMapping` 的程式碼需改用 `CodeMapping` + `BlockMapping`
- 不提供相容層（breaking change 限於內部 API）

### 移除項目

- `rebuildSourceMappings()` 方法（workaround，不再需要）
- `SourceMapping` 型別定義
- `generateNode()` 中的 `metadata.blockId` 提取邏輯
