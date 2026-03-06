# Contract: RenderStrategyRegistry

## Interface

```typescript
type RenderStrategyFn = (node: SemanticNode) => BlockState | null

interface RenderStrategyRegistry {
  register(name: string, fn: RenderStrategyFn): void
  get(name: string): RenderStrategyFn | null
  has(name: string): boolean
}
```

## Behavior

- `register()` 以 name 為 key 存入 Map。重複註冊同一 name 會覆蓋。
- name 使用命名空間：`cpp:renderVarDeclare`、`cpp:renderIf`。

## Usage in BlockSpec JSON

renderStrategy 放在 BlockSpec 的 `renderMapping` 中：

```jsonc
{
  "renderMapping": {
    "strategy": "cpp:renderVarDeclare"
  }
}
```

或由 PatternRenderer 在 loadBlockSpecs 時讀取 concept → strategy 映射。

## Execution Priority

當 PatternRenderer.render() 遇到帶有 strategy 的 renderSpec：
1. 查 RenderStrategyRegistry.get(name)
2. 若找到 → 直接調用 → 回傳 BlockState 或 null
3. 若 null → fallback 到 auto-derive 映射
4. 若找不到 → 載入時 console.warn，運行時走 auto-derive

## Error Handling

- Strategy 回傳 null → PatternRenderer 嘗試 auto-derive 映射
- Strategy 拋出異常 → catch 後視為回傳 null → 走 auto-derive
