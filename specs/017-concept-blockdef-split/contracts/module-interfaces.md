# Module Interfaces: Concept 與 BlockDef 分離

## ConceptRegistry 擴充介面

```typescript
// 新增方法：從 JSON 陣列載入 concept 定義
interface ConceptRegistry {
  // 既有方法保留不變
  register(def: ConceptDef): void
  registerOrUpdate(def: ConceptDef): void
  get(id: string): ConceptDef | undefined
  listByLayer(layer: string): ConceptDef[]
  listByLevel(level: CognitiveLevel): ConceptDef[]
  findAbstract(concreteId: string): ConceptDef | undefined
  listAll(): ConceptDef[]
  getAnnotation(conceptId: string, key: string): unknown

  // 新增：批量載入（對應 concepts.json）
  loadFromJSON(concepts: ConceptDefJSON[]): void
}
```

## BlockSpecRegistry 修改

```typescript
interface BlockSpecRegistry {
  // 既有方法簽名不變
  loadFromJSON(specs: BlockSpec[]): void
  // ... 所有既有查詢方法保留
}
```

**注意**：BlockSpecRegistry 的 `loadFromJSON` 簽名不變。adapter 層在外部將 concepts + projections 合併為 `BlockSpec[]` 後餵入。

## Adapter 函式

```typescript
/**
 * 將拆分後的 concepts + projections 合併回 BlockSpec[] 格式
 * 供下游引擎（PatternLifter, TemplateGenerator 等）使用
 */
function mergeToBlockSpecs(
  concepts: ConceptDefJSON[],
  projections: BlockProjectionJSON[]
): BlockSpec[]
```

## LanguageManifest 型別

```typescript
interface LanguageManifest {
  id: string
  name: string
  version: string
  parser: {
    type: 'tree-sitter'
    language: string
  }
  provides: {
    concepts: string[]      // 相對路徑
    blocks: string[]        // 相對路徑
    templates: string[]     // 相對路徑
    liftPatterns: string[]  // 相對路徑
  }
}
```

## SemanticTreeView 介面

```typescript
/**
 * Dummy 唯讀視圖 — 只依賴 src/core/ 型別
 */
interface SemanticTreeView {
  render(root: SemanticNode): string  // 回傳 HTML string
}
```

## 引擎介面（不變）

以下引擎介面在本次重構中 **不修改**，因為 adapter 層會餵入與舊格式相同的 `BlockSpec[]`：

- `PatternLifter.loadBlockSpecs(specs: BlockSpec[], skipNodeTypes?: Set<string>)`
- `TemplateGenerator.loadUniversalTemplates(templates: UniversalTemplate[])`
- `PatternRenderer.loadBlockSpecs(specs: BlockSpec[])`
- `PatternExtractor.loadBlockSpecs(specs: BlockSpec[])`
