# Contract: Enhanced FieldMapping & AST Resolution

## FieldMapping 新增欄位

```typescript
interface FieldMapping {
  semantic: string    // 語義屬性/子節點名稱
  ast: string         // AST 欄位引用（含新語法）
  extract: string     // text | lift | liftBody | liftChildren
  transform?: string  // TransformRegistry 中的函數名稱（僅 extract=text 時有效）
}
```

## AST 欄位解析語法（resolveAstField 增強）

| 語法 | 行為 | 範例 |
|------|------|------|
| `$text` | 節點的完整文字 | `"hello"` |
| `$operator` | 第一個 unnamed child 的文字 | `+`, `<<` |
| `fieldName` | `node.childForFieldName(fieldName)` 的文字 | `left`, `right` |
| `$namedChildren[N]` | `node.namedChildren[N]` 的文字或節點 | `$namedChildren[0]` |

### $namedChildren[N] 行為

- 當 `extract: "text"` 時：回傳 `node.namedChildren[N].text`
- 當 `extract: "lift"` 時：對 `node.namedChildren[N]` 呼叫 `ctx.lift()`
- N 為 0-based 索引，超出範圍回傳 null（不拋異常）

## Transform 執行時機

Transform 僅在 `extract: "text"` 且 resolveAstField 成功回傳非 null 值時執行：

```
resolveAstField(node, ast) → value (string | null)
  → if value !== null && transform exists:
      transformFn = TransformRegistry.get(transform)
      if transformFn: value = transformFn(value)
  → props[semantic] = value
```

## 範例

```jsonc
// return_statement: value 是 namedChildren[0]，需要 lift
{ "semantic": "value", "ast": "$namedChildren[0]", "extract": "lift" }

// string_literal: 取 $text 後去引號
{ "semantic": "value", "ast": "$text", "extract": "text", "transform": "stripQuotes" }

// comment: 取 $text 後去 // 前綴
{ "semantic": "text", "ast": "$text", "extract": "text", "transform": "cpp:stripComment" }
```
