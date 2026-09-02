# 任務：主控台回到 panel 區，而十字退場

**規格**：[spec.md](./spec.md) ｜ **計畫**：[plan.md](./plan.md)
**基準線（實測，見 research.md）**：已知退場 **329 行**，估計新增 **120 行**

> 🔴 **③ 之前不要碰 VSCode 那側。**
>
> **一次同時換「資料的形狀」與「它畫在哪」的重構，壞掉時你分不出是哪一半。**

---

## Phase 1：Setup

- [x] T001 起點 commit：`1b7794cb`（SC-003／SC-004 的 `git diff --stat` 以它為 base）

## Phase 2：Foundational（擋住所有 user story）

- [x] T002 在 `src/core/host/console-surface.ts` 定義 `ConsoleSurface`（`show`／`hide`／`isHidden`），照 [contracts](./contracts/console-surface.md)
- [x] T003 在 `tests/unit/core/console-comes-back.test.ts` 寫**先紅**的三條：關著時寫入要 `show()`／已經開著不重複 `show()`／等輸入也算輸出
- [x] T004 讓 T003 綠——那條規則寫在 `ConsolePanel` 的**寫入路徑**上，**不是各宿主各寫一份**

**Checkpoint**：`npx vitest run tests/unit/core/console-comes-back.test.ts` 綠，而**產品行為還沒動**。

---

## Phase 3：User Story 2 —— 主控台可以關，而它叫得回來 (P1)

> 🔴 **先做 US2**：US1（三個宿主一致）要先有「主控台是一條獨立的、開得關得
> 的底條」才成立——它是 US1 的前置。

**獨立測試**：關掉主控台 → 執行一支印東西的程式 → 它自己出現且印出來了。

- [x] T005 [US2] `src/ui/app-shell.ts`：`bottomContainer` 從 grid 的一格改成**編輯區底下一條全寬的**（不再有 `grid-area: state`）
- [x] T006 [US2] 主控台的開關狀態（`ConsoleVisibility`）——⚠️ **切換版面不得動它**（FR-006）
- [x] T007 [P] [US2] `e2e/console-comes-back.spec.ts`：關掉→執行→自己回來；關掉→切版面→**不准**被打開
- [x] T008 [US2] 跑 `npm test` ＋ `npm run test:e2e`

**Checkpoint**：主控台全寬、關得掉、叫得回來、有輸出自己回來。

---

## Phase 4：User Story 1 —— 三個宿主的形狀一樣 (P1) 🎯 MVP

**獨立測試**：三個宿主宣告各跑一次，版面清單與可見格子逐字相同。

- [x] T009 [US1] `src/core/host/layout-presets.ts`：`areas` 的型別收窄成 `EditorLayer`（`Exclude<UnderstandingLayer,'state'>`）——🔴 **編不過就是護欄**
- [x] T010 [US1] 十字（`'grid'`）退場：`LayoutPresetId`、`LAYOUT_PRESETS`、i18n 的 `LAYOUT_PRESET_GRID`
- [x] T011 [US1] 三張版面的 `areas` 各收成**一列**；`rows` 整格退場
- [x] T012 [US1] `reduceAreas`／`normalizeShape`／`hostLayoutOptions` 跟著簡化（沒有列要合併）
- [x] T013 [US1] `e2e/layout-presets.spec.ts` 那 7 處十字——🔴 **改它要有理由**，不是為了讓它綠；改動寫進 commit
      - 「切到十字左欄不跳走」→ **同一條性質留在三欄**（程式碼還在最左），而主控台那一半**變強**（它現在一個像素都不該動）
      - 「十字四格等大」→ **三欄三格等大**（「沒有任何一層是特別的」由三欄承接；主控台不參加比較）
      - 「四個版面裡主控台不准不見」→ **三個版面裡主控台不准被版面動到**（判準從「每張都要留一格」變成「版面碰不到它」）
      - 「十字：左上程式碼…」→ **三欄由左到右 ＋ 主控台橫在底下整條**（使用者的「完全展開」是可量的）
      - 「分隔線不得穿過跨格的格子」→ 🪦 **退場**：編輯區沒有第二列，`.grid-divider-rows` 是空的，它測不到東西；改驗「編輯區裡沒有橫線 ＋ 底下那條橫跨整條」
      - 示意圖 `[2,3,4,4]` → `[1,2,3]`（那個 `3` 是跨格，而跨格隨十字退場）
- [x] T014 [US1] 槽的選擇器四格 → 三格（spec 169 的 SC-002 那條 e2e 跟著改，同上要有理由）
      - 下拉的選項扣掉 `state`：選到它等於把「執行的輸出」塞回一欄投影裡
      - 🪦「主控台永遠叫得回來（SC-004）」**退場**——它守的是「從下拉選得回來」，而主控台不再是槽；它守的東西由 `e2e/console-comes-back.spec.ts` 用更強的形式接手（關得掉 ＋ 有輸出自己回來）
- [x] T015 [US1] 跑 `npm test` ＋ `npm run test:e2e`

**Checkpoint**：SC-001（三張、逐字相同）成立，而 VSCode 那側**還沒動**。

---

## Phase 5：I4 的反轉

> ⚠️ **先讓新的紅，再刪舊的**——否則兩者之間有一段**都沒有人守**的空窗。

- [x] T016 在 `tests/integration/audit-layout-presets.test.ts` 加**新的 I4**：主控台**叫得回來** ＋ **有輸出自己回來**（先紅）
- [x] T017 讓 T016 綠
- [x] T018 🔴 注入驗證：把「自己回來」拿掉，T016 **必須紅**
- [x] T019 刪掉舊的 I4（「state 不得缺席」那 9 行），並在 commit 說明**為什麼那條規範被反轉**

---

## Phase 6：User Story 3 —— 在 IDE 裡與原生的東西並排 (P2)

- [x] T020 [US3] `src/vscode/manifest.ts`：`viewsContainers.panel` ＋ 一個 `contributes.view.webview`（2026-09-01 拿掉過，這次是**帶著理由**加回來）
- [x] T021 [US3] `src/vscode/panel.ts`：`state` 那一種從 `WebviewPanel` 改成 `WebviewViewProvider`
- [x] T022 [US3] `vscode-profile.ts`：`output`／`inspector` 的表面改成 panel 區；`VscodeViewKind` 少一種
- [x] T023 [US3] 預檢多問一句：**主控台在 panel 區**（而「版面能力」那一行要消失）
- [x] T024 [US3] 建置 ＋ `node tools/vscode-preflight/run.mjs`

---

## Phase 7：退場 ＋ 驗收

- [x] T025 刪 `arrangeBySplitting`（37 行）
- [x] T026 刪 `detectLayoutCaps`（14 行）
- [x] T027 刪 `src/vscode/editor-layout.ts` 整支（142 行）＋ 它的測試
- [x] T028 `applyEditorLayout` 縮成「把每一格 reveal 到它那一欄」（127 → 十幾行）
- [x] T029 🔴 SC-003 驗收：`git diff --stat <base>..HEAD -- src/ tests/`，**刪 > 加**，數字寫進 commit
- [x] T030 SC-004 驗收：`git diff --stat <base>..HEAD -- e2e/` **只有 `layout-presets.spec.ts` 與新加的那一支**
- [x] T031 `knowledge/draft/2026-09-02-主控台回到-panel-區.md` 退場（反流），更新 vision 路線圖
- [x] T032 完整驗證：`npm test` ＋ `npm run test:e2e` ＋ 預檢，數字寫進 commit
- [ ] T033 ⚠️ **人工在 Arduino IDE 看一次**——它是這一刀的起點，而預檢跑的是 Chromium 不是 Theia

---

## Dependencies

```
Setup(T001) → Foundational(T002–T004)
                    ↓
              US2(T005–T008)      ← 先做：US1 需要「獨立的底條」
                    ↓
              US1(T009–T015)      ← MVP
                    ↓
              I4 反轉(T016–T019)
                    ↓
              US3(T020–T024)      ← 🔴 到這裡才碰 VSCode
                    ↓
              退場 ＋ 驗收(T025–T033)
```

## MVP Scope

**US2 ＋ US1**（T001–T015）。做到這裡「三個宿主的形狀一樣」就成立了
——而 US3 是把 IDE 那側做得原生，退場是把成果鎖住。

## ⚠️ 這份清單最容易失敗的兩個地方

**① T013／T014「改 e2e 讓它綠」。**
那兩步要改既有的 e2e，而**改測試讓它綠**是這一刀唯一會偷偷降低驗收的動作。
判準：改動要能說出「**那條測試守的東西變了**」，不是「它擋路」。

**② T029 變成一句話。**
SC-003 要**真的跑 `git diff --stat`** 並把數字寫進 commit
——不然「刪比加多」只是宣稱。
