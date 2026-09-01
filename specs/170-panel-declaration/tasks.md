# 任務：一種投影 ＝ 一份宣告

**規格**：[spec.md](./spec.md) ｜ **計畫**：[plan.md](./plan.md)
**基準線（實測，見 research.md）**：既有檔 **8**、手寫分支 **5**、頭的產生器 **5**、樣式定義 **1**

> 🔴 **這一刀動的是所有人都會經過的組裝點，而它壞掉的方式是安靜的**
> （少一格、順序變了、某個宿主少一層）。所以每一個 checkpoint 都要跑
> `npm test` ＋ `npm run test:e2e`，不是最後跑一次。

---

## Phase 1：Setup

- [x] T001 建 `src/panels/` 目錄，並在 `src/panels/README.md` 寫下這裡放什麼（一種投影一個子目錄，各含 `panel.ts`）

## Phase 2：Foundational（擋住所有 user story）

- [x] T002 在 `src/core/host/panel-spec.ts` 定義 `PanelSpec`／`PanelAction`／`PanelInstance`／`PanelContext`（照 data-model.md，`mount` 是函式不是資料）
- [x] T003 在 `src/core/host/panel-registry.ts` 實作登錄表：`allPanels`／`panelsOfLayer`／`panelsFor`／`layersOf`（照 contracts/panel-registry.md）
- [x] T004 在 `src/core/host/load-panels.ts` 用 `import.meta.glob('/src/panels/*/panel.ts', { eager: true })` 收宣告；**順序不靠 glob 的鍵順序**，由 `LAYER_ORDER` ＋ 宣告的 `order` 決定
- [x] T005 在 `tests/unit/core/panel-registry.test.ts` 寫**先紅**的四條「要出聲」：id 撞名／層認不得／`nameKey` 查不到／**一份宣告都沒有**（入口條件）
- [x] T006 讓 T005 綠——出聲走既有的 `diagNote`／組裝點出聲機制，**不得靜默降級**（第七十五條護欄的判準）

**Checkpoint**：`npx vitest run tests/unit/core/panel-registry.test.ts` 綠，而**產品行為一個字都還沒動**。

---

## Phase 3：User Story 2 —— 四格的頭由同一份宣告產生 (P1)

> 🔴 **先做 US2 不是 US1**：頭的產生器統一是 US1 的前置——`app-shell` 的迴圈
> 要有一支產生器可以呼叫，否則迴圈裡還是四個 if。

**獨立測試**：四格的頭結構相同（名字在最左、動作接在後面），而且是同一支產生器產的。

- [ ] T007 [US2] 在 `src/ui/layout/panel-head.ts` 寫唯一的頭產生器 `buildPanelHead(spec, inst)`：名字（`nameKey` → 下拉）排最左，`spec.head` 的動作照宣告順序接在後面
- [ ] T008 [P] [US2] 在 `tests/unit/ui/panel-head.test.ts` 驗：兩個動作的宣告 → 那條頭上就是那兩顆、順序相同；名字永遠在最左
- [ ] T009 [US2] `src/ui/panels/flow-panel.ts` 改用 `buildPanelHead`（自動排版／縮放三顆變成 `head` 宣告），刪掉 `bar.className = 'flow-toolbar'` 那段
- [ ] T010 [US2] `src/ui/panels/monaco-panel.ts` 同上（複製／插入／覆蓋貼上 → `head` 宣告）
- [ ] T011 [US2] `src/ui/layout/bottom-panel.ts` 同上（⚠️ 分頁列是**內容導覽**不是動作——它進 `head` 的哪一種，照 data-model.md「一層可多份宣告」處理）
- [ ] T012 [US2] `src/ui/toolbar/quick-access-bar.ts` 與 `app-shell` 的 `.panel-head` 收進同一支產生器
- [ ] T013 [US2] 跑 `npm test` ＋ `npm run test:e2e`——🔴 **e2e 一條都不准改**（SC-004）

**Checkpoint**：頭的產生器 **5 → 1**（SC-003），樣式定義維持 1，全套與 e2e 綠。

---

## Phase 4：User Story 1 —— 加一種投影，只加不改 (P1) 🎯 MVP

**獨立測試**：合成一種只畫一段文字的投影，驗它在**不修改既有檔**的前提下
出現在版面清單、槽的選擇器與版面裡。

- [ ] T014 [US1] 把四種既有投影搬成宣告：`src/panels/{code,flow,blocks,console,variables}/panel.ts`（**行為不動**，`mount` 直接呼叫既有的類別）
- [ ] T015 [US1] `src/core/view-host.ts` 的 `LAYER_ORDER` 改由登錄表導出（或保留為根宣告而登錄表驗證它——研究時二選一，理由寫進 commit）
- [ ] T016 [US1] `src/ui/app-shell.ts`：**建容器 ＋ `grid-area`** 那一段收成迴圈（跑 `panelsFor(profile)`）
- [ ] T017 [US1] `src/ui/app-shell.ts`：`applyLayout` 的四行 display 分支收成迴圈
- [ ] T018 [US1] `src/ui/app-shell.ts`：`layerAvailable` 改問 `spec.availableIn(profile)`，不再有 `element`／`state` 的手寫分支
- [ ] T019 [US1] `src/ui/app-shell.ts`：`SLOT_BARS` 與 `mountSlotPickers` 收成同一個迴圈
- [ ] T020 [US1] 跑 `npm test` ＋ `npm run test:e2e`
- [ ] T021 [US1] 在 `tests/integration/panel-declaration-open.test.ts` 寫 SC-001 的測試：測試檔**自己**合成一份 `probe` 宣告推進登錄表，斷言版面清單／槽的選項／`mount` 被呼叫都認得它
- [ ] T022 [US1] 🔴 驗 T021 **只 import 登錄表與組裝點**——需要 import `app-shell` 才跑得動就代表耦合還在（quickstart §一）

**Checkpoint**：SC-001（既有檔 8 → 0）與 SC-002（手寫分支 5 → 0）都成立。

---

## Phase 5：User Story 3 —— 宿主少了某幾層時仍然成立 (P2)

**獨立測試**：兩個宿主宣告各跑一次，版面清單與可見的格子與今天逐字相同。

- [ ] T023 [US3] `src/core/host/layout-presets.ts` 的 `reduceAreas`／`hostLayoutOptions` 改吃 `layersOf(profile)`，不再自己算
- [ ] T024 [P] [US3] 在 `tests/unit/core/host-layout-options.test.ts` 補：**一層都沒有的宿主**版面清單為空而**不拋錯**（2026-09-01 踩過的那個）
- [ ] T025 [US3] 建置 vsix 並跑 `node tools/vscode-preflight/run.mjs`——三種視窗各一格、把手 0、版面四張、主控台兩個分頁，與今天逐字相同

**Checkpoint**：兩個宿主的行為逐字相同。

---

## Phase 6：Polish ＆ 護欄

- [ ] T026 [P] 在 `tests/integration/audit-panel-declaration.test.ts` 寫護欄：`app-shell` 裡「四個一起列」的結構 **必須是 0**、頭的產生器**必須是 1**、樣式定義**必須是 1**
- [ ] T027 🔴 注入驗證：把其中一段改回手寫，T026 **必須紅**——不會紅的護欄是裝飾
- [ ] T028 SC-005：把 `src/panels/flow/panel.ts` 暫時改名，跑 `npm test`，確認**只有流程自己的測試會紅**；結果寫進 commit
- [ ] T029 更新 `knowledge/concepts/開放擴充.md` 那張表：「新一種投影」那一列從 🔴 8 個檔改成 🟢 無
- [ ] T030 `knowledge/draft/2026-09-01-面板模組化.md` 退場（反流：教訓 → experience，轉變 → history），並更新 vision 路線圖
- [ ] T031 跑完整驗證：`npm test` ＋ `npm run test:e2e` ＋ 預檢，數字寫進 commit

---

## Dependencies

```
Setup(T001) → Foundational(T002–T006)
                    ↓
              US2(T007–T013)     ← 🔴 先做：US1 的迴圈需要那支產生器
                    ↓
              US1(T014–T022)     ← MVP
                    ↓
              US3(T023–T025)
                    ↓
              Polish(T026–T031)
```

## Parallel Opportunities

- T008 與 T009–T012 之間：測試先寫，四個改寫可並行（不同檔）
- T024 與 T023 可並行（測試檔／實作檔不同）
- T026 與 T028 可並行

## MVP Scope

**US2 ＋ US1**（T001–T022）。做到這裡，「加一種投影 ＝ 一份宣告」就成立了，
而 US3 是既有行為的保護、Polish 是把它釘住。

## ⚠️ 這份任務清單最容易失敗的地方

**T021／T022 變成一句話。** 如果那支測試需要 import `app-shell` 才跑得動，
它證明的就不是「不用碰別的」——**而它仍然會綠**。
T022 是專門為了擋這件事而存在的一步。
