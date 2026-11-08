# Data Model: 「提議中」的變更

## NodeSpec（插入時給的新節點）
| 欄位 | 型別 | 規則 |
|---|---|---|
| componentId | string | 必須是認得的元件 |
| properties | Record<string, PropertyValue>? | 每個鍵都是那顆元件宣告的屬性 |
| slots | Record<string, NodeSpec[]>? | 每個鍵是宣告的接點；子節點合 `allowed`、數量不超過 `max` |

## TreeOp（結構操作）
| op | 欄位 | 意思 |
|---|---|---|
| `insert` | parent, slot, index, node: NodeSpec | 在 parent 的 slot 第 index 個位置插入 |
| `remove` | node | 刪除該節點（含子孫） |
| `move` | node, parent, slot, index | 移到 parent 的 slot 第 index 個位置（index 以移除後計） |
| `setProperty` | node, name, value | 設定屬性 |

## Proposal
| 欄位 | 型別 | 說明 |
|---|---|---|
| id | string | 系統發 |
| author | string | 送出者自填；空 → 「未具名」 |
| rationale | string | 理由 |
| ops | TreeOp[] | 至少一步 |
| refs | Record<nodeId, componentId> | 送出當下引用到的節點與其元件（過期判準） |
| status | `pending` \| `stale` \| `accepted` \| `rejected` \| `refused` | 見狀態轉移 |
| reason | ProposalReason? | 被拒或過期的原因 |
| submittedAt | number | 排序用 |

## ProposalReason
`{ step: number | null, nodeId?: string, code: ReasonCode, detail: string }`
ReasonCode：`empty`、`node-missing`、`node-changed`、`unknown-component`、`unknown-slot`、`slot-mismatch`、`slot-full`、`unknown-property`、`bad-value`、`index-out-of-range`、`root`、`cycle`。

## 狀態轉移
```
submit ─┬─ 驗證不過 ─────────────→ refused（不入佇列，回傳原因）
        └─ 驗證過 → pending
pending ── 樹改了且仍套得過 ──→ pending（差異重算）
pending ── 樹改了且引用不在／元件變了／套不過 → stale
stale   ── 樹回到可套用（例如復原）→ pending
pending ── 人按接受 → accepted（edit:tree）
pending／stale ── 人按退回 → rejected
```
佇列只保存 pending／stale；accepted／rejected 移出（`get(id)` 仍可查最後狀態，保留最近 50 筆）。
