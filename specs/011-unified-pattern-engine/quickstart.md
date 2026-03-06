# Quickstart: 如何在三層架構中新增概念

## Layer 1：純 JSON（最簡單）

適用於：結構匹配明確、不需要文字轉換的概念。

**步驟**：只修改 JSON 檔案。

1. 在 `lift-patterns.json` 新增 pattern：
```jsonc
{
  "id": "cpp_break",
  "astNodeType": "break_statement",
  "concept": { "conceptId": "break" }
}
```

2. 在 block spec JSON 確認有對應的 blockDef 和 concept（通常已存在）。

**驗證**：寫一個測試驗證 `break;` → semantic node → block → code 的 roundtrip。

## Layer 2：JSON + Transform（需要文字轉換）

適用於：AST 節點的文字需要去引號、去前綴等轉換。

**步驟**：修改 JSON + 在語言模組中註冊 transform。

1. 在語言模組的 transforms 檔案中註冊：
```typescript
// src/languages/cpp/lifters/transforms.ts
export function registerCppTransforms(registry: TransformRegistry): void {
  registry.register('cpp:stripComment', (text) => {
    if (text.startsWith('//')) return text.slice(2).trim()
    if (text.startsWith('/*')) return text.slice(2, -2).trim()
    return text
  })
}
```

2. 在 `lift-patterns.json` 中引用 transform：
```jsonc
{
  "id": "cpp_comment",
  "astNodeType": "comment",
  "concept": { "conceptId": "comment" },
  "fieldMappings": [
    { "semantic": "text", "ast": "$text", "extract": "text", "transform": "cpp:stripComment" }
  ]
}
```

**驗證**：寫一個測試驗證 `// hello` → `{ concept: "comment", properties: { text: "hello" } }`。

## Layer 3：JSON + Strategy（複雜邏輯）

適用於：條件路由、深層巢狀提取、動態欄位生成。

**步驟**：修改 JSON + 在語言模組中註冊 strategy。

### Lift Strategy 範例

1. 在語言模組的 strategies 檔案中註冊：
```typescript
// src/languages/cpp/lifters/strategies.ts
export function registerCppLiftStrategies(registry: LiftStrategyRegistry): void {
  registry.register('cpp:liftPreprocInclude', (node, ctx) => {
    const pathNode = node.namedChildren.find(
      c => c.type === 'system_lib_string' || c.type === 'string_literal'
    )
    if (!pathNode) return null
    const rawPath = pathNode.text
    if (rawPath.startsWith('<') && rawPath.endsWith('>')) {
      return createNode('cpp_include', { header: rawPath.slice(1, -1) })
    }
    if (rawPath.startsWith('"') && rawPath.endsWith('"')) {
      return createNode('cpp_include_local', { header: rawPath.slice(1, -1) })
    }
    return null
  })
}
```

2. 在 `lift-patterns.json` 中引用 strategy：
```jsonc
{
  "id": "cpp_preproc_include",
  "astNodeType": "preproc_include",
  "liftStrategy": "cpp:liftPreprocInclude",
  "priority": 20
}
```

### Render Strategy 範例

1. 在語言模組的 render strategies 中註冊：
```typescript
// src/languages/cpp/renderers/strategies.ts
export function registerCppRenderStrategies(registry: RenderStrategyRegistry): void {
  registry.register('cpp:renderInput', (node) => {
    const values = node.children.values ?? []
    const block = { type: 'u_input', id: nextBlockId(), fields: {}, inputs: {} }
    for (let i = 0; i < values.length; i++) {
      block.fields[`NAME_${i}`] = values[i].properties.name ?? 'x'
    }
    if (values.length > 1) {
      block.extraState = { varCount: values.length }
    }
    return block
  })
}
```

2. 在 BlockSpec 或 PatternRenderer 設定中關聯 strategy。

**驗證**：寫一個整合測試驗證完整的 code→semantic→blocks→code roundtrip。

## 核心引擎不需要改動

以上三層操作都不修改 `src/core/` 下的任何檔案。核心引擎只提供 Registry 介面和 Pattern Engine 的查找邏輯。
