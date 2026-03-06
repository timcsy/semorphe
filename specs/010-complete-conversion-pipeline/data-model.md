# 資料模型：補齊轉換管線（完全重寫版）

## 核心實體關係

```
BlockSpec (JSON 定義，唯一真相來源)
  ├── concept
  │   ├── conceptId          → SemanticNode.concept
  │   ├── abstractConcept    → 跨語言抽象概念映射
  │   ├── properties[]       → 語義屬性名稱列表
  │   └── children{}         → 語義子節點名稱列表
  ├── blockDef               → Blockly UI 定義
  ├── codeTemplate           → 語義→程式碼模板
  ├── astPattern             → 程式碼→語義辨識模式
  └── renderMapping          → 語義→積木欄位對應（可自動推導）

LiftPattern (JSON 定義，語言模組)
  ├── astNodeType            → tree-sitter AST nodeType
  ├── patternType            → simple | chain | composite | ...
  ├── concept.conceptId      → 目標語義概念 ID
  └── extract / chain / composite → 模式特定的提取規則

UniversalTemplate (JSON 定義，語言模組)
  ├── conceptId              → universal 語義概念 ID
  ├── pattern / styleVariants → C++ 程式碼模板
  └── styleKey               → 分支所依據的 style 欄位

SemanticNode (runtime)
  ├── concept                ← BlockSpec.concept.conceptId
  ├── properties             ← 從 astPattern 提取 / 從 blockDef 提取
  ├── children               ← 遞迴 lift / 遞迴 extract
  └── metadata               ← sourceRange, blockId, rawCode
```

## 四引擎與 JSON 資料流

```
                    ┌─────────────────────┐
                    │   JSON 定義檔案群    │
                    │  (唯一真相來源)       │
                    └─────────┬───────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
  │ blockDef      │  │ codeTemplate  │  │ astPattern    │
  │ + concept     │  │ + universal   │  │ + lift-patterns│
  │ + renderMapping│  │   templates  │  │               │
  └───┬───────┬───┘  └──────┬───────┘  └───────┬───────┘
      │       │             │                   │
      ▼       ▼             ▼                   ▼
  ┌──────┐ ┌──────┐   ┌──────────┐        ┌──────────┐
  │引擎3 │ │引擎4 │   │  引擎2   │        │  引擎1   │
  │Render│ │Extract│   │Generator │        │ Lifter   │
  └──┬───┘ └──┬───┘   └────┬─────┘        └────┬─────┘
     │        │             │                   │
     ▼        ▼             ▼                   ▼
  Semantic  Semantic     Semantic            Semantic
  → Blocks  ← Blocks    → Code             ← Code(AST)
```

## 型別擴充

### AstPattern 型別（src/core/types.ts）

```typescript
// 現有欄位保留
interface AstPattern {
  nodeType: string
  constraints: AstConstraint[]
}

// 擴充
interface AstPatternExtended extends AstPattern {
  patternType?: 'simple' | 'operatorDispatch' | 'chain' | 'composite'
                | 'unwrap' | 'contextTransform' | 'multiResult'
  fieldMappings?: FieldMapping[]
  operatorDispatch?: OperatorDispatchDef
  chain?: ChainDef
  composite?: CompositeDef
  unwrapChild?: number | string
  contextTransform?: ContextTransformDef
  multiResult?: MultiResultDef
}
```

### RenderMapping 型別（新增）

```typescript
interface RenderMapping {
  fields: Record<string, string>            // blockField → semanticProperty
  inputs: Record<string, string>            // blockInput → semanticChild (expression)
  statementInputs: Record<string, string>   // blockInput → semanticChild (statements)
  dynamicInputs?: DynamicInputDef           // 可變數量 inputs
}

interface DynamicInputDef {
  semanticChild: string                     // 語義子節點陣列名
  inputPrefix: string                       // 積木 input 前綴 (如 "ARG_")
  countProperty?: string                    // extraState 中的計數欄位
}
```

### UniversalTemplate 型別（新增）

```typescript
interface UniversalTemplate {
  conceptId: string
  pattern?: string                          // 單一模板
  styleVariants?: Record<string, CodeTemplate>  // 按 style 分支
  styleKey?: string                         // StylePreset 中的分支欄位
  order: number
  imports?: string[]
}
```

## 概念分層（P2 概念代數）

| 層級 | 概念數量 | JSON 來源 | 積木定義 | code/ast 定義 |
|------|---------|-----------|---------|-------------|
| Layer 0 Universal | ~25 | universal.json | blockDef + renderMapping | 語言模組 JSON |
| Layer 1 Lang-Core | ~17 | cpp/blocks/basic.json + special.json | 四維完整定義 | 同一 JSON |
| Layer 2 Lang-Library | ~27 | cpp/blocks/advanced.json | 四維完整定義 | 同一 JSON |
