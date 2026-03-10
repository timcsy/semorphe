# 快速入門：Semantic Node Identity

**功能**: 021-semantic-node-identity | **日期**: 2026-03-10

## 整合情境

### 情境 1：程式碼生成時建立 CodeMapping

```typescript
import { generateCodeWithMapping } from './core/projection/code-generator'

// 語義樹（已有 node.id）
const tree = createNode('program', {}, {
  body: [
    createNode('print', {}, { values: [createNode('string_literal', { value: 'Hello' })] })
  ]
})

// 生成程式碼 + mapping
const { code, mappings } = generateCodeWithMapping(tree, 'cpp')

// mappings 使用 nodeId（非 blockId）
// [{ nodeId: 'node_1_xxx', startLine: 0, endLine: 0 }]
console.assert(mappings[0].nodeId === tree.children.body[0].id)
console.assert(!('blockId' in mappings[0]))
```

### 情境 2：積木渲染時建立 BlockMapping

```typescript
import { renderToBlocklyState } from './core/projection/block-renderer'

// 同一棵語義樹
const { blockState, blockMappings } = renderToBlocklyState(tree)

// blockMappings 記錄 nodeId → blockId
// [{ nodeId: 'node_1_xxx', blockId: 'block_1' }]
console.assert(blockMappings[0].nodeId === tree.children.body[0].id)
console.assert(!('startLine' in blockMappings[0]))
```

### 情境 3：跨投影高亮查詢

```typescript
// Block → Code（使用者點擊積木）
const blockId = 'block_1'
const bm = blockMappings.find(m => m.blockId === blockId)
if (bm) {
  const cm = codeMappings.find(m => m.nodeId === bm.nodeId)
  if (cm) {
    monacoPanel.addHighlight(cm.startLine + 1, cm.endLine + 1)
  }
}

// Code → Block（使用者點擊程式碼行）
const line = 3  // 0-based
const cm = codeMappings.find(m => line >= m.startLine && line <= m.endLine)
if (cm) {
  const bm = blockMappings.find(m => m.nodeId === cm.nodeId)
  if (bm) {
    blocklyPanel.highlightBlock(bm.blockId)
  }
}
```

### 情境 4：無 Blockly 渲染的 CodeMapping

```typescript
// 核心價值：code→blocks 方向不再需要等 Blockly 渲染
const liftedTree = liftCode('cout << "Hello" << endl;', 'cpp')
const { code, mappings } = generateCodeWithMapping(liftedTree, 'cpp')

// mappings 已有效（使用 node.id），不需呼叫 rebuildSourceMappings
console.assert(mappings.length > 0)
console.assert(mappings.every(m => m.nodeId && m.startLine >= 0))
```

## 驗證步驟

1. **單元測試**: `npx vitest run tests/unit/core/code-generator-mapping.test.ts`
2. **整合測試**: `npx vitest run tests/integration/source-mapping.test.ts`
3. **全測試套件**: `npx vitest run`
4. **瀏覽器手動測試**:
   - 開啟 `npm run dev`
   - 新增積木 → 點擊積木 → 驗證程式碼行高亮
   - 點擊程式碼行 → 驗證積木高亮
   - 切換 L0/L1/L2 認知等級 → 驗證高亮持續正確
