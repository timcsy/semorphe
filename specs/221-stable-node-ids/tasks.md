# Tasks: 改程式碼之後，沒動到的節點保住身分

- [ ] T001 寫 `tests/unit/core/sync/carry-ids.test.ts`：完全相同沿用全部；改一個字面值沿用（含那一顆）；中間插入一句；刪掉兩句相同中的一句；有增有刪數量不同那一段換新；元件換了不沿用；舊身分不重複給
- [ ] T002 實作 `src/core/sync/carry-ids.ts`
- [ ] T003 `ProposalQueue.staleAll`（`tests/unit/core/proposals/proposal-queue.test.ts` 加：staleAll 之後 revalidate 不會變回 pending）；`ReasonCode` 加 `replaced`
- [ ] T004 `SyncController.handleEditCode` 接 `carryIds`；`tests/unit/core/sync/` 或整合測試：改一行之後未動的節點身分不變
- [ ] T005 App：`programReplaced()` 接進套範例、換目標、課文起始程式（arrange／debug）、匯入
- [ ] T006 e2e：`e2e/proposals.spec.ts` 把「改程式碼 → 過期」改成「改別處 → 仍可接受」＋「刪掉它指的節點 → 過期」＋「套範例 → 過期」
- [ ] T007 型別、`test:unit`、`test:guard`（基線手改附 note）、長測試（全套＋建置＋e2e）
