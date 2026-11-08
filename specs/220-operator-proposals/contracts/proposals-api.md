# Contract: 提議的程式化入口

外部操作者（AI、測試）只能**送出與查詢**；接受與退回只在畫面上由人按（FR-013）。

```ts
interface ProposalInput {
  author?: string
  rationale?: string
  ops: TreeOp[]          // data-model.md
}

interface SubmitResult {
  id: string
  status: 'pending' | 'refused'
  reason?: ProposalReason
}

interface ProposalsFacade {
  submit(input: ProposalInput): SubmitResult
  list(): ProposalView[]                 // 佇列中的（pending／stale），依送出順序
  get(id: string): ProposalView | null   // 含已接受／退回／被拒的最後狀態
}

interface ProposalView {
  id: string; author: string; rationale: string
  status: Proposal['status']; reason?: ProposalReason
  diff?: DiffLine[]                      // pending／stale 時以目前的程式碼計
}
type DiffLine = { kind: ' ' | '+' | '-'; text: string }
```

- 網頁版與 IDE webview：`window.__app.proposals`。
- 核心純函式（兩個宿主、Node 皆可）：
  - `applyOps(tree, ops, schema) → { ok: true, tree } | { ok: false, reason }`（不改動輸入）
  - `refsOf(tree, ops) → Record<nodeId, componentId>`
  - `lineDiff(before: string, after: string) → DiffLine[]`
