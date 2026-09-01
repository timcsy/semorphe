# Implementation Plan: 每個槽自己選視圖，而復原不屬於任何一個槽

**Branch**: `169-slot-view-picker` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

## Summary

兩件事：**↩↪ 搬回它本來就屬於的地方**（全域，桌機的標頭），
以及**每個槽自己選視圖**（分頁列由槽產生，所有槽共用同一份選項）。
核心是把使用者的覆寫存成**層與層的置換**——因為槽沒有穩定身分，而層有。

## Technical Context

**語言／框架**：TypeScript 5.x，無新相依
**動到的檔**：
```
src/core/host/slot-assignment.ts   新：置換的型別與三個純函數
src/core/host/layout-presets.ts    不動（areas 仍然是預設）
src/ui/app-shell.ts                ↩↪ 搬家 · 槽的分頁列 · effectiveAreas
src/ui/toolbar/quick-access-bar.ts 🪦 移除 view-tabs 那一組
src/ui/layout/status-bar-controls.ts  新增「主控台」那一顆
src/ui/style.css                   .slot-tabs
tests/unit/core/slot-assignment.test.ts        新
tests/integration/audit-slot-tabs.test.ts      新（第九十九條）
e2e/slot-view-picker.spec.ts                   新
e2e/layout-presets.spec.ts                     ⚠️ 兩支要改（view-tabs 沒了）
```

## Constitution Check

| 原則 | 評估 |
|---|---|
| **I. 簡約優先** | 🟢 無新相依；`areas` 不動；置換是**四個字的 Record**，不是一套新狀態機 |
| **II. TDD** | 🟢 順序：先蓋第九十九條護欄（選項集合相同）並看它紅，再做 |
| **III. Git 紀律** | 🟢 每個 Phase 一個 commit |
| **IV. 規格文件保護** | 🟢 只新增 `specs/169-*` |
| **V. 繁體中文優先** | 🟢 |

🔴 **要記的一筆**：本刀讓 **I3 在「套用後的結果」上不再成立**（宣告仍然驗）。
理由與代價見 [research.md](./research.md) 決策 3 與 spec 的 Assumptions①。

## 實作階段

### Phase 0：護欄先紅

1. 新增 `tests/integration/audit-slot-tabs.test.ts`（第九十九條）：
   **每一個槽的分頁列選項集合必須完全相同**，＋ 置換的四條不變式（A1–A4）
2. 跑：**必須紅**（今天沒有 `slot-assignment.ts`、也沒有 `.slot-tabs`）

### Phase 1：置換（純函數）

1. `src/core/host/slot-assignment.ts`：型別 ＋ `identityAssignment` ／ `swapTo` ／ `effectiveAreas`
2. `tests/unit/core/slot-assignment.test.ts`：四條不變式 ＋ 兩個反例注入
3. Phase 0 的不變式那半轉綠

### Phase 2：↩↪ 搬家（桌機）

1. e2e 先寫：四個版面 ↩↪ 都看得見，且 `closest(投影容器)` 是 `null`
2. `quick-access-bar.ts` 🪦 移除 `#view-tabs` 那一組
3. `app-shell.ts` 桌機把 `#undo-slot` 插進 `header .toolbar-actions`
   ——🪦 順手刪掉「快速列跟著看得見的那一欄走」那段補丁
4. ⚠️ **行動版一個字都不改**（`adoptActionBarSections` 仍然把 `#undo-group` 搬進行動列）
5. e2e 轉綠

### Phase 3：槽的分頁列

1. e2e 先寫：每個槽的選項集合相同、換一個槽其餘不動
2. `app-shell.ts` 每個槽容器最上緣加一條 `.slot-tabs`（**一份產生器，四個槽共用**）
3. 點一顆 → `swapTo` → 重新 `applyLayout`
4. `style.css` 的 `.slot-tabs`
5. Phase 0 的護欄整支轉綠

### Phase 4：指派存起來 ＋ 主控台叫得回來

1. 指派跟著版面存進 `semorphe-state`（走既有的存檔遷移）
2. 狀態列新增「主控台」那一顆——按了把 `state` 換回來
3. e2e：切走再切回來指派不變 · 主控台叫得回來

### Phase 5：收尾

`npm test` ＋ `npm run test:e2e` ＋ 基線上調 ＋ knowie 反流 ＋ commit/push

## Complexity Tracking

| 複雜度 | 為什麼必要 | 更簡單的做法為何不夠 |
|---|---|---|
| 置換而不是 `槽 → 層` | 槽沒有穩定身分（版面一換槽數就變） | `槽索引 → 層` 在切版面時意義改變 ＝ 資料遺失 |
| 分頁列由槽產生（一份共用） | SC-002 要求選項集合完全相同 | 每個面板自帶一條的話，「一樣」變成靠人維護的規範 |
| 狀態列多一顆「主控台」 | 置換可以把 `state` 換走 | 禁止換走會讓主控台變成「那個不能動的特別的」 |

## T001 的產出：快速列今天裝了什麼

```
sync-menu-btn                          網頁版沒有（宿主才有）
view-blocks-btn / view-flow-btn        🪦 這一刀拆掉——改由槽提供
level/track/lesson/template/scaffold   桌機走狀態列，`inPanel` 為 false
block-style-selector-mount             同上
undo-slot（undo-btn / redo-btn）        🚚 搬到標頭
clear-btn                              留在快速列——它是【積木】的動作
```

⚠️ 所以拆完之後快速列在桌機上**只剩「清空」一顆**。
🔴 而那正是它該有的樣子：**它是積木面板的工具列**，不是「什麼都塞的那一條」。

## 風險

```
🔴 ↩↪ 搬進標頭在【窄視窗】會擠爆——行動版實測過（390px）
   → 緩解：只在桌機搬；行動版那條路一個字不改；e2e 兩種寬度各驗一次
🟡 每個槽多一條分頁列 ＝ 每格少 ~28px 高
   → 十字在 13 吋上每格只剩 ~276px。緩解：分頁列做薄（24px），且只在桌機
🟡 存檔多一個欄位 → 走既有的 storage 遷移（`migrate-storage` 的規矩）
```
