# Quickstart：驗這一刀真的做到了

## ① 復原到處都在（US2 · SC-001）

逐一套用四個版面，每一次都找得到 ↩↪，而且它**不在**任何一格投影裡面。

```js
const u = document.getElementById('undo-group')
;({ 看得見: u.getClientRects().length > 0,
    住在哪: u.closest('#code-column,#flow-column,#blocks-column,#bottom-container')?.id ?? '（不在任何一格）' })
```
**預期**：`看得見: true`、`住在哪: （不在任何一格）`

## ② 每個槽的分頁列選項一樣（US1 · SC-002）

```js
[...document.querySelectorAll('.slot-tabs')].map(t =>
  [...t.querySelectorAll('[data-layer]')].map(b => b.dataset.layer).join(','))
```
**預期**：陣列裡每一項**完全相同**。

## ③ 換一個槽，其餘不動（SC-003）

1. 在「對照」量四格的 rect
2. 把右槽從積木改成流程
3. 再量一次
**預期**：格子的位置與大小**完全相同**，只有裡面的東西換了。

## ④ 主控台叫得回來（US3 · SC-004）

把主控台那一格換成別的，然後按狀態列的「主控台」。
**預期**：主控台回來了。

## ⑤ 切走再切回來，指派不變（SC-005）

在「對照」把右槽改成流程 → 切到「三欄」→ 切回「對照」。
**預期**：右槽仍然是流程。

## 自動化

```bash
npx vitest run tests/unit/core/slot-assignment.test.ts        # 置換的四條不變式
npx vitest run tests/integration/audit-slot-tabs.test.ts      # 護欄：選項集合相同
npx playwright test e2e/slot-view-picker.spec.ts              # ①–⑤
```
