# Contract: 比對器（核心，純模組）

```ts
type Judge = (tree: SemanticNode, scenario: Scenario) => Promise<RunOutcome>
compareInterpretations(
  student: SemanticNode,
  references: { id: string; label: string; tree: SemanticNode }[],
  scenarios: Scenario[],
  judge: Judge,
): Promise<ComparisonResult>
```
- MUST NOT import DOM、`node:fs`、任何提供者（護欄量 import）。
- 判決不是 accept 的情境：該側標 incomparable，不算一致也不算不一致（FR-008）。
- 輸出比較：`out` 逐字；Arduino 另比腳位最後狀態。
- 只有一個解讀：status 等同對錯（FR-009）。
