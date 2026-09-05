# Tasks: 骨架在積木那側上匯流排

**Input**: `specs/172-scaffold-on-bus/` 的 [spec.md](spec.md) · [plan.md](plan.md) ·
[research.md](research.md) · [data-model.md](data-model.md) · [quickstart.md](quickstart.md)

**Tests**: 🔴 **要**。憲章 II 是非妥協條款，而這一刀的護欄**今天就會紅在真的那一行上**
——那是最好的一種「先紅」。

**Organization**: 依 user story 分階段。US1（外觀不變）與 US2（拖曳不壞）都是 P1
——⚠️ 它們**驗的是同一次改動的兩個面向**，所以合成一個實作階段，但驗收分開。

---

## Phase 1：Setup

- [X] T001 確認 preview 伺服器是新的：`pkill -f "vite preview"; npm run build && npm run preview &`
      然後 `npx playwright test e2e/aaa-fresh-build.spec.ts`
      ——⚠️ 這個 repo 有一個踩過三次的陷阱（`reuseExistingServer` 會餵舊的 build），
      而 e2e 的每一個結論都建在它上面

---

## Phase 2：Foundational（先紅）

**Purpose**: 讓「今天是錯的」這件事變成一個會出聲的東西。
⚠️ **這一階段結束時應該有紅的**——那是它做對了的樣子。

- [X] T002 [P] 新增護欄 `tests/integration/audit-scaffold-on-bus.test.ts`：
      掃 `src/`，`.markScaffoldBlocks(` 出現在 `src/ui/panels/blockly-panel.ts`
      **以外**的檔案 → 報檔名 ＋ 行號。
      🔴 **跑它，它必須紅在 `src/ui/app.ts` 的 `remarkScaffold()` 那一行**
      ——如果它綠，是掃描路徑寫錯了，不是債已經清了
- [X] T003 [P] 同檔加**入口條件**測試：掃到的 `src/` 檔案數 ≥ 1
      ——⚠️ 掃不到檔案時上面那條會「空過」，而空過與通過長得一樣
- [X] T004 [P] 同檔加**注入測試**（第四十九條）：
      合成一份「組裝點裡有那一行」的輸入 → 必須報得出檔名與行號；
      合成一份乾淨的 → 不得報
- [X] T005 [P] ~~新增 e2e~~ 🟢 **既有的就夠**（憲章 I）：`e2e/scaffold-across-views.spec.ts`
      ＋ `e2e/scaffold-code-complete.spec.ts` 共 10 支，已涵蓋三段鷹架的**外觀基線**
      （`hidden` 沒有骨架積木 · `ghost` 骨架是淡的 · `editable` 全部實心）。
      🟢 **它今天就該綠**——這一刀的驗收是「改完之後還是綠」
- [X] T006 [P] 🟢 **同上**——拖曳基線：`ghost` 下拖一塊非骨架積木 → 它動；
      拖一塊骨架積木 → 它不動。
      ⚠️ 這一條擋的是 `app.ts:1757` 記著的那個雷（`setDragStrategy`）

**Checkpoint**: T002 紅（在真的那一行上）· T005／T006 綠。

---

## Phase 3：US1 + US2（P1）— 讓積木那側也走匯流排

**Goal**: 骨架告示只有一條路，而外觀與拖曳逐字不變。

**Independent Test**: T005／T006 改完之後仍然全綠；T002 由紅轉綠。

- [X] T007 [US1] `src/core/sync-controller.ts`：加一支「重發骨架告示」。
      發 `semantic:update`，帶 `tree`（現在那棵）＋ `code` ＋
      `scaffold: this.scaffoldNotice(tree)`，`source: 'resync'`，
      🔴 **不帶 `blockState`**（見 [data-model.md](data-model.md)：
      那個缺席不是省略，是這則事件「只做一件事」的開關）
- [X] T008 [US1] `src/ui/panels/blockly-panel.ts` 的 `onSemanticUpdate`：
      讀 `event.scaffold` 並套用。
      🔴 **放在 `if (!mine && event.blockState)` 那道閘門【之外】**
      ——套骨架不需要重畫，而那道閘門是為重畫設的
- [X] T009 [US2] 同檔：`markScaffoldBlocks` 從對外可見改成內部（`private`）
      ——⚠️ 這一步會讓 `src/ui/app.ts` 的呼叫**編譯不過**，那是預期的
- [X] T010 [US1] `src/ui/app.ts`：`remarkScaffold()` 退場；
      `markOutOfScopeBlocks()` 裡那一行改成「叫真相那側重發」。
      ⚠️ **`setTimeout(…, 900)` 一個都不動**——它擋的是「換目標途中」那個雷
      （`app.ts:757` 記著使用者當時說「怎麼裡面的非骨架積木也淡了」），
      與這一刀無關
- [X] T011 [US1] `npx tsc --noEmit` 乾淨
- [X] T012 [US1] T002 由紅轉綠；T005 仍綠
- [X] T013 [US2] T006 仍綠
      ——🔴 **這一條是這一刀唯一可能爆的地方**。它紅的話先看時序：
      新的事件是不是比 `getVisibleComponents()` 早到了

**Checkpoint**: 四條測試全綠，而 `markScaffoldBlocks` 的產品呼叫者 = 0。

---

## Phase 4：US3（P2）— 擋回頭路

**Goal**: 下一次「順手加一行」會被擋下來。

⚠️ **它的實作在 T002 就做完了**——這一階段只是確認它真的在守。

- [X] T014 [US3] 用**備份檔**注入一次真的呼叫（`cp src/ui/app.ts /tmp/app.bak` → 注入
      → 跑 → `cp /tmp/app.bak src/ui/app.ts`），確認 T002 紅、訊息說得出行號。
      🔴 **不要用 `git checkout` 還原**——那個檔多半有未提交的改動，
      而 `checkout` 的還原點是 HEAD，不是「注入之前」（2026-09-05 踩過）
- [X] T015 [US3] 還原後 `grep -c` 一次關鍵字，確認數目對得上

---

## Phase 5：Polish

- [X] T016 `npm test` 全套綠
- [X] T017 `audit-four-independences` 的方法呼叫數**下調**
      ——🟢 **它紅是成功的樣子**（數字下降了）。基線裡寫註記說明是哪一筆呼叫沒了
- [X] T018 [P] `src/core/view-host.ts:104` 那條「⚠️ 積木那一側今天還走組裝點直接呼叫」
      改寫——它記的是債，而債清了。改成記「**為什麼是這個形狀**」
      （不帶 `blockState` ＝ 只套骨架不重畫）
- [X] T019 [P] `npx playwright test` 全套綠
- [X] T020 手動看一眼：開一堂 `ghost` 的課，**課程中途切換鷹架深度**
      → 外觀當場跟著變（FR-003）。⚠️ 測試綠不代表使用者看到的是對的
- [X] T021 `knowledge/vision.md` 那一筆打勾 ＋ `knowledge/history/` 一筆轉變
      ——🔴 轉變裡要寫一句「`markOutOfScopeBlocks()` **仍然**同時做兩件事，
      而拆它不在這一刀」，不然下一個人會以為那是漏掉的
- [X] T022 commit（三段：先紅 · 實作 · 收尾）

---

## Dependencies

```
T001 ─→ T005 T006          （e2e 要新的 build）
T002 ─→ T003 T004 T014     （同一個檔）
T007 ─→ T008 ─→ T009 ─→ T010 ─→ T011 ─→ T012 T013
                                          └─→ T016 ─→ T017 ─→ T019 ─→ T021 ─→ T022
T012 ─→ T014 ─→ T015
```

## Parallel

- **Phase 2**：T002／T003／T004 是同一個檔（不平行）；T005／T006 是另一個檔，
  可與 T002 那組同時寫
- **Phase 5**：T018 與 T019 可平行（不同檔）

## MVP

🔴 **這一刀沒有 MVP 可切**——它是一次搬家，搬一半的話兩條路同時在，
而那正是它要解掉的東西。

**最小可交付 ＝ Phase 2 + Phase 3**（護欄 ＋ 搬家）。
Phase 4 是確認護欄真的在守，Phase 5 是收尾。
