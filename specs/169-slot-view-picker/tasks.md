# Tasks: 每個槽自己選視圖，而復原不屬於任何一個槽

**Feature**: `specs/169-slot-view-picker` | **Plan**: [plan.md](./plan.md)

⚠️ **憲法 II（TDD）**：先寫會紅的檢查 → 再實作 → 轉綠。
⚠️ **憲法 III（Git）**：每個 Phase 結束 commit。

---

## Phase 1：Setup

- [x] T001 讀 `src/ui/app-shell.ts` 的 `applyLayout` 與 `quick-access-bar.ts`，把「今天由**快速列**提供、而搬家後會失去主人的東西」列進 `specs/169-slot-view-picker/plan.md` 的風險段

---

## Phase 2：Foundational（護欄先紅）

- [x] T002 新增 `tests/integration/audit-slot-tabs.test.ts`（第九十九條）：硬性零「**每一個可見槽的分頁列選項集合完全相同**」＋ 置換的四條不變式 A1–A4（見 `data-model.md`）
- [x] T003 [P] 在同一支加**兩個合成反例**注入（不是雙射／少一層，見 `contracts/slot-assignment.md`）
- [x] T004 跑 `npx vitest run tests/integration/audit-slot-tabs.test.ts`——**必須紅**，把它逐項指名的內容貼進 commit 訊息

---

## Phase 3：置換（純函數）

- [x] T005 新增 `src/core/host/slot-assignment.ts`：`SlotAssignment` 型別 ＋ `identityAssignment()`／`swapTo()`／`effectiveAreas()`
- [x] T006 [P] 新增 `tests/unit/core/slot-assignment.test.ts`：四條不變式 ＋「連續兩次同樣的 swapTo 回到原狀」＋「形狀不變（格數／跨度／state 必在）」
- [x] T007 跑 T004——**不變式那半要轉綠**（分頁列那半仍然紅）。`npx tsc --noEmit` 乾淨。commit

---

## Phase 4：User Story 2 — 復原到處都按得到（P1）

**獨立驗收**：四個版面 ↩↪ 都看得見，且不在任何投影容器裡。

- [x] T008 [US2] 新增 `e2e/slot-view-picker.spec.ts`，寫「↩↪ 在四個版面都看得見、且 `closest('#code-column,#flow-column,#blocks-column,#bottom-container')` 是 null」。**先跑，必須紅**
- [x] T009 [US2] `src/ui/toolbar/quick-access-bar.ts`：🪦 移除 `#view-tabs` 那一組（分頁列改由槽提供）
- [x] T010 [US2] `src/ui/app-shell.ts`：桌機把 `#undo-slot` 插進 `header .toolbar-actions`；🪦 刪掉 `applyLayout` 裡「快速列跟著看得見的那一欄走」與「收起 view-tabs ＋ 那一槓」兩段補丁
- [x] T011 [US2] ⚠️ 確認**行動版一個字都沒改**：`adoptActionBarSections` 仍然把 `#undo-group` 搬進 `#mobile-action-bar`。跑 `e2e/mobile-undo-everywhere.spec.ts`
- [x] T012 [US2] 跑 T008——**必須轉綠**。⚠️ `e2e/layout-presets.spec.ts` 那兩支提到 `view-tabs` 的要跟著改（那一組已經不存在）。commit

---

## Phase 5：User Story 1 — 每個槽自己選視圖（P1）

**獨立驗收**：在「對照」把右槽從積木換成流程，左槽不變。

- [x] T013 [US1] 在 `e2e/slot-view-picker.spec.ts` 加「每個槽的分頁列選項集合完全相同」與「換一個槽，其餘格子位移為 0」。**先跑，必須紅**
- [x] T014 [US1] `src/ui/app-shell.ts`：一份 `buildSlotTabs(layer)` 產生器，四個槽容器最上緣各插一條 `.slot-tabs`（**共用同一份選項**）
- [x] T015 [US1] 點一顆 → `swapTo(assignment, 那一格現在的層, 選的層)` → 重新 `applyLayout`（`applyLayout` 改讀 `effectiveAreas`）
- [x] T016 [P] [US1] `src/ui/style.css` 加 `.slot-tabs`（薄，24px；目前那一顆要標示）
- [x] T017 [P] [US1] i18n：分頁列的字用既有的 `LAYER_*` 鍵（第七十八條：不得把 id 印上畫面）
- [x] T018 [US1] 跑 T013 與 T004——**兩支都要全綠**。開瀏覽器實測四個版面各換一次。commit

---

## Phase 6：User Story 3 — 指派存得住、主控台叫得回來（P2）

- [x] T019 [US3] 在 `e2e/slot-view-picker.spec.ts` 加「切走版面再切回來，指派不變」與「主控台被換走之後叫得回來」。**先跑，必須紅**
- [x] 🪦 ~~T020 指派跟著版面存~~ —— **實作時發現不需要**：置換是「層 → 層」，與版面無關，一份全域的就夠。⚠️ 跨重新載入不保證，而版面本身今天也不存（一致，不是遺漏）
- [x] 🪦 ~~T021 狀態列新增「主控台」那一顆~~ —— **實作時發現多餘**：每一格的下拉都列著主控台，它永遠叫得回來。加了反而讓主控台變成「那個有特權的」
- [x] T022 [US3] 跑 T019——**必須轉綠**。commit

---

## Phase 7：Polish

- [x] T023 `npm test`（全套）＋ `npm run test:e2e`
- [x] T024 基線該上調的上調，每一筆在 `note` 寫明是**輸入量**還是**清償**
- [x] T025 `npx tsc --noEmit` 乾淨
- [x] T026 knowie 反流：教訓 → `experience.md`；轉變（I3 降級、↩↪ 的歸屬）→ `knowledge/history/200`；路線圖那一項收成一行 ＋ 指標；draft 退場
- [x] T027 升 vsix 版本 ＋ `npm run preflight:vscode`
- [x] T028 commit ＋ push ＋ tag

---

## Dependencies

```
Phase 1 ─▶ 2 ─▶ 3 ─▶ 4 (US2) ─▶ 5 (US1) ─▶ 6 (US3) ─▶ 7

🔴 US2 在 US1 之前：US1 要把 view-tabs 那一組拆掉，而拆掉之後
   ↩↪ 會沒有主人——先讓它有家，再拆。
🟢 US3 依賴 US1（沒有分頁列就沒有「被換走」這件事）
```

## 可平行的

```
T003 ∥ T002 之後    護欄的注入與斷言不同段
T006 ∥ T005 之後    單元測試與實作不同檔
T016 ∥ T017         樣式與 i18n 不同檔
```

## MVP

**Phase 1–4**（到 T012）＝ ↩↪ 不再屬於積木。那已經解決使用者問的第一件事，
而第二件（每個槽自己選）是 Phase 5。

## 格式檢核

- [x] 全部 28 條都有 `- [ ]`、`T0NN`、以及檔案路徑
- [x] `[US1]`／`[US2]`／`[US3]` 只出現在故事 Phase
- [x] `[P]` 只標在不同檔且無未完成相依的任務
