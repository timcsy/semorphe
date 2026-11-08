# Contract: 情境登記處（核心）

```ts
registerScenarioKind(kind: string, generator: (tree: SemanticNode) => Scenario[]): void
scenarioGeneratorsFor(tree: SemanticNode): Scenario[]   // 所有登記的種類各產生、合併、每種上限 20
```
- 核心 MUST NOT 寫出任何一種 kind 的名字（護欄）。
- 同一個 kind 登記兩次 throw。
- 產生器 MUST 決定性（同一棵樹 → 同一批情境，順序固定）。
