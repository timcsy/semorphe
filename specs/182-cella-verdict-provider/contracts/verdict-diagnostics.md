# Contract: 判決 → 診斷（`core/verdict-diagnostics.ts`）

```ts
toDiagnostics(input: {
  verdict: Verdict | null            // null ＝ 能力缺（沒有提供者／載入失敗）
  types: TypeQuery | null
  tree: SemanticNode                 // 送出判決時的那一棵（用來找節點與祖先）
  readsInput: boolean                // 樹裡有讀取輸入的節點
  hasStdin: boolean                  // 有課文測資
}): { diagnostics: Diagnostic[]; notes: string[] }   // notes 進狀態列（需要輸入、需要 Cella、未知種類）
```

不變式：
- accept 且沒有型別不合 ⟹ 診斷 0 則（不產生「通過」雜訊）
- 尚未支援的構造 ⟹ `severity: 'info'`，永不 `'error'`（SC-002）
- 每則診斷的 `nodeId` 都在 `tree` 裡（或是它最近的祖先）
- `readsInput && !hasStdin` ⟹ 沒有 `ub*`／`fuel` 的診斷（SC-005）
- `verdict === null` ⟹ 診斷 0 則，`notes` 有一句「需要 Cella」（FR-011）
