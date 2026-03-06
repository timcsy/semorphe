# Contract: TransformRegistry

## Interface

```typescript
type TransformFn = (text: string) => string

interface TransformRegistry {
  register(name: string, fn: TransformFn): void
  get(name: string): TransformFn | null
  has(name: string): boolean
}
```

## Behavior

- `register()` 以 name 為 key 存入 Map。重複註冊同一 name 會覆蓋。
- `get()` 回傳函數或 null（不拋異常）。
- name 支援命名空間：`stripQuotes`（核心）、`cpp:stripComment`（語言模組）。

## Core Transforms（隨引擎初始化時註冊）

| Name | Input | Output |
|------|-------|--------|
| `stripQuotes` | `"hello"` or `'a'` | `hello` or `a` |
| `stripAngleBrackets` | `<iostream>` | `iostream` |

## Usage in JSON

```jsonc
{
  "fieldMappings": [
    { "semantic": "value", "ast": "$text", "extract": "text", "transform": "stripQuotes" }
  ]
}
```

## Error Handling

- 若 `transform` 引用的名稱不存在，PatternLifter 跳過 transform（使用原始文字），載入時 console.warn。
- 若 transform 函數拋出異常，catch 後使用原始文字。
