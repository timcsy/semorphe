# Tasks: 版面——四張示意圖，而沒有任何一層是特別的

**Feature**: `specs/168-layout-thumbnails` | **Plan**: [plan.md](./plan.md)

⚠️ **憲法 II（TDD 非妥協）**：每一個 Phase 都是「先寫會紅的檢查 → 再實作 → 轉綠」。
⚠️ **憲法 III（Git 紀律）**：每個 Phase 結束 commit 一次。

---

## Phase 1：Setup

- [x] T001 讀 `src/ui/app-shell.ts` 的 `applyLayout`（約 620–670 行）與 `src/ui/layout/split-pane.ts`，把今天用到的 inline 樣式**逐項列進** `specs/168-layout-thumbnails/plan.md` 的風險段——Phase 2 要把它們全部刪掉，漏掉一個就會兩處寫同一份狀態

---

## Phase 2：Foundational（阻斷所有故事，先做）

**目的**：把宣告從一維換成二維，並讓護欄先紅。

- [x] T002 把 `tests/integration/audit-layout-presets.test.ts` 的四條斷言改成六條不變式 I1–I6（見 `data-model.md`）：矩形／值是宣告過的層／每列每欄都是 `LAYER_ORDER` 子序列／`state` 恰好一個連續矩形且不得缺席／同一層最多一個連續矩形／`'*'` 只准在 `focus`
- [x] T003 [P] 在同一支護欄加**四個合成反例**的注入（鏡像、一層兩塊、沒有 state、不是矩形）——見 `contracts/layout-declaration.md` 的反例段。⚠️ 反例用合成層名，不得用真實宣告
- [x] T004 跑 `npx vitest run tests/integration/audit-layout-presets.test.ts`——**必須紅**，並把它逐項指名的內容貼進 commit 訊息（`build-guardrail` §6.5）
- [x] T005 在 `src/core/host/layout-presets.ts` 加 `LayoutSlot` 型別與 `areas` 欄位，填入四份宣告（`focus`／`compare`／`three-column`／`grid`），🔴 **並整個移除 `layers`**——留著就是兩份真相
- [x] T006 在 `src/core/host/layout-presets.ts` 實作三個純函數 `gridTemplateAreas(preset, focusLayer?)`／`thumbnailCells(preset)`／`occupiedLayers(preset)`
- [x] T007 [P] 在 `tests/unit/core/layout-presets.test.ts`（新）釘住三個純函數：四份宣告各自的 grid 字串、縮圖格數與跨度、看得到哪幾層
- [x] T008 修好 `layers` 被移除後的所有呼叫端（`src/ui/app-shell.ts` 的 `wants()`），跑 `npx tsc --noEmit`
- [x] T009 跑 T004 那條護欄——**必須轉綠**。commit：「Phase 2：版面宣告變成二維」

---

## Phase 3：User Story 2 — 十字，而且切過去時東西不跳走（P1）

> ⚠️ **US2 排在 US1 前面**：示意圖要畫的是「套用之後長什麼樣」，
> 而套用還沒能表達十字之前，那張圖畫出來是空頭支票。

**獨立驗收**：從「對照」切到「十字」，程式碼與積木的 rect 位移為 0。

- [x] T010 [US2] 在 `e2e/layout-presets.spec.ts`（新）寫「位移 0」那一支：在「對照」量 `#code-column`／`#blocks-column` 的 rect，切到「十字」再量，斷言 `x`／`y`／`width` 相同。**先跑，必須紅**（今天沒有十字）
- [x] T011 [US2] 在同一支 e2e 寫「四個版面主控台都在」（US3 的驗收，與這一支共用備置）。**先跑，必須紅**
- [x] T012 [US2] 在 `src/ui/style.css` 把編輯區容器改成 `display: grid`，並讓四個面板容器各自帶 `grid-area: element|relation|space|state`
- [x] T013 [US2] 改寫 `src/ui/app-shell.ts` 的 `applyLayout`：只做「設 `grid-template-areas`（`'*'` 用當下那一層代換）」，🪦 **刪掉 T001 列出來的每一條 inline 樣式操作**（`display:none`／`flexDirection`／`flex`／`width`）
- [x] T014 [US2] 把 `src/ui/layout/bottom-panel.ts` 的拖曳高度改成寫 **grid 的列高**，🪦 刪掉寫元素高度的那一份（決策 5 的已知風險：兩處寫同一份狀態）
- [x] T015 [US2] 跑 T010／T011——**必須轉綠**。開瀏覽器實測四張圖各切一次（`experience`「重構後開瀏覽器實測」）。commit：「Phase 3：套用改走 CSS Grid，十字可用」

---

## Phase 4：User Story 1 — 用圖挑版面（P1）

**獨立驗收**：開選單看到四張圖，點第三張變三欄。

- [x] T016 [US1] 在 `e2e/layout-presets.spec.ts` 加「選單裡有四張圖，且每張圖的格數與宣告一致」。**先跑，必須紅**
- [x] T017 [P] [US1] 在 `src/i18n/zh-TW/*` 與 `en/*` 加 `LAYOUT_PRESET_GRID` 與四層的名稱鍵（若缺）
- [x] T018 [US1] 新增 `src/ui/toolbar/layout-thumbnails.ts`：吃 `thumbnailCells(preset)` 產生一個小 `display: grid`，格子裡放層的 i18n 名。🔴 **不得手畫 SVG 或硬編標記**（FR-003）
- [x] T019 [US1] 版面那一格的選單改用它——沿用 `showQuickPick` 的開關／鍵盤／篩選行為，只換每一列的渲染
- [x] T020 [P] [US1] 在 `src/ui/style.css` 加縮圖樣式（格線、目前那一張的標示）
- [x] T021 [US1] 跑 T016——**必須轉綠**。開瀏覽器實測：不讀文字挑得出「四格」那一張（SC-001）。commit：「Phase 4：版面選單換成示意圖」

---

## Phase 5：User Story 3 — 主控台不會被版面弄不見（P2）

> 🟢 它的實作在 T005（I4）與 T012（`grid-area: state`）就完成了；
> 這個 Phase 只驗收，不寫新程式。

- [x] T022 [US3] 跑 T011 那一支 e2e（四張圖主控台都在），並確認十字時它在**右下格**而非底部橫幅
- [x] T023 [US3] 手動驗 `quickstart.md` 的 ④：十字裡主控台格上緣有「主控台／變數」分頁且切得動（FR-007）

---

## Phase 6：Polish

- [x] T024 跑 `npm test`（全套）＋ `npm run test:e2e`——本刀動的全是使用者按得到的東西
- [x] T025 該上調的基線上調，每一筆在 `note` 寫明是**輸入量**還是**清償**（`build-guardrail` §7）
- [x] T026 `npx tsc --noEmit` 乾淨
- [x] T027 knowie 反流：`knowledge/draft/2026-08-31-版面的四張圖.md` 的教訓 → `experience.md`；轉變（第八十一條的兩條硬性零升成二維）→ `knowledge/history/`；路線圖那一項收成一行 ＋ 指標，draft 退場
- [x] T028 commit ＋ push

---

## Dependencies

```
Phase 1 ──▶ Phase 2 ──┬──▶ Phase 3 (US2) ──▶ Phase 4 (US1) ──▶ Phase 5 (US3) ──▶ Phase 6
                      └──  T007 可與 T005/T006 之後平行

🔴 US2 必須在 US1 之前：圖畫的是「套用之後長什麼樣」，
   套用不能表達十字之前，那張圖是空頭支票
🟢 US3 沒有自己的實作——它的不變式在 Phase 2（I4）與 Phase 3（grid-area）就成立了
```

## 可平行的

```
T003 ∥ T002 之後       護欄的注入與斷言不同段
T007 ∥ T008            單元測試與呼叫端修正不同檔
T017 ∥ T018 ∥ T020     i18n／元件／樣式三個不同檔
```

## MVP

**Phase 1 ＋ 2 ＋ 3**（到 T015）＝ 十字可用、四張版面都套用得了，
而選單仍是文字列。那已經解決了使用者提出的**那個不對稱**——
示意圖（Phase 4）是把它變好用，不是讓它成立。

## 格式檢核

- [x] 全部 28 條都有 `- [ ]`、`T0NN`、以及檔案路徑
- [x] `[US1]`／`[US2]`／`[US3]` 只出現在故事 Phase；Setup／Foundational／Polish 沒有
- [x] `[P]` 只標在不同檔且無未完成相依的任務
