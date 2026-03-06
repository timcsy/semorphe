# Contract: LiftStrategyRegistry

## Interface

```typescript
type LiftStrategyFn = (node: AstNode, ctx: LiftContext) => SemanticNode | null

interface LiftStrategyRegistry {
  register(name: string, fn: LiftStrategyFn): void
  get(name: string): LiftStrategyFn | null
  has(name: string): boolean
}
```

## Behavior

- 函數簽名與現有 hand-written lifter（`NodeLifter`）完全一致，可直接遷移。
- `register()` 以 name 為 key 存入 Map。重複註冊同一 name 會覆蓋。
- name 使用命名空間：`cpp:liftFunctionDef`、`cpp:liftPreprocInclude`。

## Usage in JSON (lift-patterns.json)

```jsonc
{
  "id": "cpp_function_definition",
  "astNodeType": "function_definition",
  "concept": { "conceptId": "func_def" },
  "liftStrategy": "cpp:liftFunctionDef"
}
```

## Execution Priority

當 PatternLifter 遇到帶有 `liftStrategy` 的 pattern entry：
1. 查 LiftStrategyRegistry.get(name)
2. 若找到 → 直接調用 → 回傳結果（非 null）或嘗試下一個 pattern（null）
3. 若找不到 → 載入時 console.warn，運行時跳過此 entry

## Error Handling

- Strategy 回傳 null → PatternLifter 嘗試同 nodeType 的下一個 pattern entry（按 priority 排序）
- Strategy 拋出異常 → catch 後視為回傳 null
