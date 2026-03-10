# 資料模型：Semantic Node Identity

**功能**: 021-semantic-node-identity | **日期**: 2026-03-10

## 實體

### CodeMapping（程式碼映射）

將語義節點與生成程式碼中的行號範圍關聯。

| 欄位 | 型別 | 說明 | 約束 |
|------|------|------|------|
| nodeId | string | 語義節點 ID（`createNode()` 分配） | 必填，非空 |
| startLine | number | 起始行號（0-based） | >= 0 |
| endLine | number | 結束行號（0-based, inclusive） | >= startLine |

**來源**: `generateCodeWithMapping()` 在程式碼生成過程中記錄
**消費者**: `sync-controller.ts` 用於 code→block 高亮查詢
**生命週期**: 每次程式碼生成時完全重建

### BlockMapping（積木映射）

將語義節點與對應的 Blockly 積木關聯。

| 欄位 | 型別 | 說明 | 約束 |
|------|------|------|------|
| nodeId | string | 語義節點 ID | 必填，非空 |
| blockId | string | Blockly 積木 ID（`nextBlockId()` 分配） | 必填，非空 |

**來源**: `renderToBlocklyState()` 在積木渲染過程中記錄
**消費者**: `sync-controller.ts` 用於 block→code 高亮查詢
**生命週期**: 每次積木渲染時完全重建

### SemanticNode.id（既有）

| 欄位 | 型別 | 說明 | 約束 |
|------|------|------|------|
| id | string | 唯一識別碼，格式 `node_{counter}_{timestamp}` | 自動分配，不可變 |

**來源**: `createNode()` 在 `semantic-tree.ts`
**用途**: 所有投影映射的 join key

## 關聯

```text
SemanticNode.id ←── CodeMapping.nodeId   (1:1)
SemanticNode.id ←── BlockMapping.nodeId  (1:1)
BlockMapping.blockId ──→ Blockly Block   (1:1)
CodeMapping.[startLine, endLine] ──→ 生成程式碼行  (1:N)
```

## 查詢路徑

### Block → Code（點擊積木 → 高亮程式碼）

```text
blockId → BlockMapping(blockId) → nodeId → CodeMapping(nodeId) → [startLine, endLine]
```

### Code → Block（點擊程式碼行 → 高亮積木）

```text
line → CodeMapping(line ∈ [startLine, endLine]) → nodeId → BlockMapping(nodeId) → blockId
```

## 與舊模型的差異

### 舊模型（SourceMapping）

```typescript
interface SourceMapping {
  blockId: string    // ← 投影層 ID，耦合 Blockly
  startLine: number
  endLine: number
}
```

- 程式碼映射直接包含 blockId → 投影間耦合
- 需等 Blockly 渲染完成才能建立映射
- 無法在無積木渲染的情況下產出映射

### 新模型

```typescript
interface CodeMapping {
  nodeId: string     // ← 語義層 ID，解耦
  startLine: number
  endLine: number
}

interface BlockMapping {
  nodeId: string
  blockId: string
}
```

- 各投影獨立維護自己的映射
- 程式碼映射在生成時即可產出（不依賴 Blockly）
- 跨投影查詢透過 nodeId join
