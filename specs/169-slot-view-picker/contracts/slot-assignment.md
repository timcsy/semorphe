# Contract：槽的指派

**誰是消費者**：套用（`applyLayout`）· 分頁列（每個槽一條）· 護欄（新的一條）· 存檔。

## 匯出

```ts
identityAssignment(): SlotAssignment
swapTo(a: SlotAssignment, from: UnderstandingLayer, to: UnderstandingLayer): SlotAssignment
effectiveAreas(preset, a, focusLayer?): readonly (readonly UnderstandingLayer[])[]
```

## 保證

1. **雙射**：`swapTo` 的結果永遠是雙射（A1）——所以同一層不會出現在兩個槽。
2. **對調而不是覆蓋**：`swapTo(a, space, relation)` 之後，原本放 relation 的那一格放 space。
3. **形狀不變**：`effectiveAreas` 只換名字——格數、跨度、`state` 必在都與 `areas` 相同（A2）。
4. **恆等可回**：連續兩次同樣的 `swapTo` 回到原狀（A4 的推論）。

## 反例（護欄會擋下的）

```ts
{ element: 'space', relation: 'space', space: 'element', state: 'state' }   // ❌ A1：不是雙射
{ element: 'element', relation: 'relation', space: 'space' }                // ❌ A1：少一層
```
