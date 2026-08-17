# Tasks：擴充長成能用的——雙向同步／高亮／執行／設定

**Feature**: 139-vscode-two-way　**Date**: 2026-08-17
**Input**: [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md) · [contracts/sync-protocol.md](./contracts/sync-protocol.md) · [data-model.md](./data-model.md) · [quickstart.md](./quickstart.md)

---

## 🔴 讀這份清單之前

**這一刀「一次做完」八個故事，而這個專案有一份正是那樣出事的病歷**
（`history/072`：`c-style-parity` 10/10 全綠，**而瀏覽器上仍然產出 `<iostream>`**）。

> **它不是因為某一項做錯了，是因為「每一項都有人看」
> 與「整體有人看」不是同一件事。**

**處置寫進了結構**：

```
每個 Phase 結束都要能回答「使用者現在多做得到什麼」
🔴 一個「要等全部做完才驗得了」的 Phase，就是切錯了
```

⚠️ 而**七條驗收我勾不掉**（要在 VSCode 裡按鍵拖曳）——T042 是**交棒**不是驗收。

---

## Phase 1：Setup

- [ ] T001 確認 spec 138 的成果可建可裝：`npm run build:vscode` 產得出 `.vsix`
- [ ] T002 記下本輪的回歸基準：全套測試數、`.vsix` 大小（約 456 KB）、探針數字

**關卡**：基準記下來了 —— ⚠️ **沒有基準的「沒退步」是講不出來的**。

---

## Phase 2：Foundational —— 四塊純函式（🔴 **唯一能完整 TDD 的一塊**）

**目標**：把本輪的核心邏輯全部變成**可單元測的純函式**。
**憲法 II**：測試先寫，Red → Green。
**契約**：[contracts/sync-protocol.md](./contracts/sync-protocol.md) 第六節。

### ① 範圍計算（US1 的核心）

- [ ] T003 撰寫 `tests/integration/vscode-rewrite-span.test.ts`：🔴 **主斷言是「把回傳的範圍套用到 before，逐字元等於 after」**——⚠️ **不是**「跨距看起來合理」
- [ ] T004 於同檔加：`before === after` → 回傳 `null`（不產生空編輯）
- [ ] T005 於同檔加：只差一行的輸入 → 跨距 **1**
- [ ] T006 於同檔加：🔴 **`before` 是「文件的實際文字」而不是 `generate(原樹)`**——用一段**排版不同但語義相同**的輸入，斷言套用結果仍然逐字元正確（`research.md` 第一節記的那個錯）
- [ ] T007 於同檔加：純函式性質——同輸入同輸出、無狀態
- [ ] T008 確認 T003–T007 全部 **Red**
- [ ] T009 實作 `src/core/projection/rewrite-span.ts`（🟢 放中立目錄：它不認識任何宿主）
- [ ] T010 確認 T003–T007 全部 **Green**
- [ ] T011 🔴 把 `tests/probes/edit-blast-radius.test.ts` 改成 **import `src/core/projection/rewrite-span`**，刪掉它本地那份，並確認**數字一個都沒變**（中位 1 行、≤1 行 99.5%、跨距>半檔 0 筆）

### ② 回音守衛（US2 的核心）

- [ ] T012 [P] 撰寫 `tests/integration/vscode-echo-guard.test.ts`：記下的 version 回來 → 判為回音並移除
- [ ] T013 [P] 於同檔加：🔴 **連續兩次編輯**產生兩個 version，**先回來的那個仍判為回音**（⚠️ 這一條是「集合 vs 單一變數」的分水嶺）
- [ ] T014 [P] 於同檔加：沒記過的 version → 判為外來變更
- [ ] T015 [P] 於同檔加：上界用**數量**——🔴 **測試裡不得出現任何計時**
- [ ] T016 實作 `src/vscode/sync/echo-guard.ts`

### ③ 設定解析（US5 的核心）

- [ ] T017 [P] 撰寫 `tests/integration/vscode-settings.test.ts`：優先序 語言覆寫 > 專案 > 使用者 > 內建預設
- [ ] T018 [P] 於同檔加：沒有任何設定時回傳完整的預設組態（不得有 `undefined` 漏出去）
- [ ] T019 實作 `src/vscode/sync/settings.ts`（⚠️ 純函式：吃「各層級的值」回傳組態，**不 import `vscode`**）

### ④ 視圖狀態（US7 的核心）

- [ ] T020 [P] 撰寫 `tests/integration/vscode-view-state.test.ts`：存了再取得回同一份
- [ ] T021 [P] 於同檔加：🔴 **身分搬遷**——`untitled:` 的狀態搬到 `file://` 之後，舊 key 不再存在、新 key 拿得到
- [ ] T022 實作 `src/vscode/sync/view-state.ts`（⚠️ 純函式 ＋ 一個可注入的儲存介面，**不 import `vscode`**）

**關卡**：四塊全綠；`npx tsc --noEmit` 過；🔴 **T011 的數字沒變**。

> **使用者現在多做得到什麼**：⚠️ **什麼都沒有** ——
> 這是唯一一個不對使用者交付的 Phase，而它的存在理由是**後面七個都靠它**。

---

## Phase 3：User Story 6 —— 它看起來像 Semorphe（P2）🔴 **先做，因為後面每一步都要看得見**

**故事目標**：面板有工具箱、深色、與網頁版一致。
**獨立測試**：打開面板 → 看得到分類 → 拉一顆積木出來。

- [ ] T023 🔴 **單獨一個 commit**：把 `createDarkTheme()` 從 `src/ui/panels/blockly-panel.ts:764` 的 private 抽成共用（⚠️ **這是本輪唯一動到網頁版程式碼的一步**）
- [ ] T024 🔴 **T023 之後立刻**跑 `npm test` ＋ 探針，確認網頁版零變化 —— **不與其他改動混在一起**（`history/072`）
- [ ] T025 [US6] 於 `src/vscode/webview/main.ts` 把 `Blockly.inject` 補齊七項：`renderer: 'zelos'`／`theme`／`grid`／完整的 `zoom`／`trashcan`／`media`／`toolbox`
- [ ] T026 [US6] 於 `src/vscode/webview/main.ts` 接上 `buildToolbox()`（`ui/toolbox-builder.ts:45`），組態暫時用內建預設
- [ ] T027 [US6] 更新 `tools/vscode-preflight/run.mjs`：新增斷言「工具箱分類數 > 0 且與網頁版相同」
- [ ] T028 [US6] 建置 ＋ 跑預檢，確認畫布深色、有工具箱、console 錯誤仍為 0

**關卡（SC-009）**：工具箱分類數與網頁版相同。

> **使用者現在多做得到什麼**：**看得到分類、拉得出積木**（雖然還不會改程式碼）。

---

## Phase 4：User Story 1 —— 改積木，程式碼跟著變（P1）

**故事目標**：只重寫改到的那一段；一次修改一個復原步驟；拖位置不動檔案。
**獨立測試**：改一個欄位 → 看變更行數 → 按一次 Cmd+Z。

- [ ] T029 [US1] 於 `src/vscode/panel.ts` 建立訊息通道，並把 `document`（全文＋版本＋uri＋語言）送進 Webview
- [ ] T030 [US1] 於 `src/vscode/webview/main.ts` 判斷積木事件**有沒有改變語義**：🔴 純移動 → 只更新視圖狀態、**不送 `applyEdit`**
- [ ] T031 [US1] 於 `src/vscode/webview/main.ts` 用 `generateCode` 產新全文，與**文件文字**算出 `RewriteSpan` 並送出
- [ ] T032 [US1] 於 `src/vscode/panel.ts` 套用編輯：一次修改 = **一個復原步驟**；並把產生的 version 記進回音守衛
- [ ] T033 [US1] 於 `src/vscode/webview/main.ts` 讀數新增「**這次改了幾行**」與「**第幾次編輯**」（🔴 交棒要看它）
- [ ] T034 [US1] 建置 ＋ 裝進 VSCode

**關卡（SC-001／002／003）**：⚠️ **這三條的最終判定在 T042**，本 Phase 只確保**做得出來**。

> **使用者現在多做得到什麼**：**改積木，檔案真的跟著變，而且只變那一段**。

---

## Phase 5：User Story 2 —— 改程式碼，積木跟著變（P1）

**故事目標**：貼一段程式積木重畫，**而且停下來**。

- [ ] T035 [US2] 🔴 於 `src/vscode/webview-html.ts` 的 CSP **只加 `'wasm-unsafe-eval'` 一項**——⚠️ **不得**順手加 `'unsafe-eval'`、**不得**放寬 `default-src`、既有五條一個字不動
- [ ] T036 [US2] 於 `tests/integration/vscode-panel-html.test.ts` 加一條護欄式斷言：CSP 含 `'wasm-unsafe-eval'` **且不含** `'unsafe-eval'`
- [ ] T037 [US2] 於 `src/scripts/build-vscode.ts` 把 tree-sitter 的兩個 wasm 複製進封包
- [ ] T038 [US2] 建立 `src/vscode/webview/lift.ts`：初始化 tree-sitter（wasm 路徑走與 media 同一套 URI）＋ parse ＋ lift
- [ ] T039 [US2] 於 `src/vscode/panel.ts` 接上回音守衛：文件變更事件 → 是回音就停、不是就送 `document`
- [ ] T040 [US2] 於 `src/vscode/webview/main.ts` 收到 `document` 時重繪積木，🔴 **並對 Blockly `setRecordUndo(false)`**（重繪不是使用者的操作）
- [ ] T041 [US2] 讀數新增「**是不是回音**」與「膠囊／tree-sitter 載入狀態」

**關卡（SC-004／005）**：🔴 `grep -rn "setTimeout" src/vscode/` → **零筆**。

> **使用者現在多做得到什麼**：**貼上 AI 給的程式碼，積木跟著出來**（主場景）。

---

## Phase 6：User Story 3 —— 點一邊，另一邊亮起來（P1）

- [ ] T042 [US3] 建立 `src/vscode/webview/highlight.ts`：行 → nodeId、nodeId → 行 的雙向反查（⚠️ 純函式，可單元測）
- [ ] T043 [P] [US3] 撰寫 `tests/integration/vscode-highlight.test.ts`：兩個方向各一組正向；🔴 **並含「節點沒有 sourceRange」的退路**（實測 1.5%）
- [ ] T044 [US3] 於 `src/vscode/panel.ts` 實作程式碼側高亮 ＋ 捲到可見；並訂閱游標變更送 `selection`
- [ ] T045 [US3] 於 `src/vscode/webview/main.ts` 收到 `selection` 時選取對應積木；🔴 **值相等就不再傳播**（選取是冪等的，見契約第三節②）
- [ ] T046 [US3] 讀數新增「**目前選取的 nodeId**」

**關卡（SC-006）**：雙向都成立且不進迴圈。

> **使用者現在多做得到什麼**：**兩個視圖看起來是同一個東西了**。

---

## Phase 7：User Story 4 —— 單步執行，看著程式在積木上走（P2）

- [ ] T047 [US4] 於 `src/vscode/webview/main.ts` 接上既有的 `StepController`（`ui/step-controller.ts:11`）與執行路徑
- [ ] T048 [US4] 於 Webview 面板加單步／執行／停止的控制，並在**積木側**高亮當前節點
- [ ] T049 [US4] 🔴 把 `ExecutionAtNodeEvent` 送到主行程，由 `src/vscode/panel.ts` 在**程式碼側**畫出來——⚠️ **原生編輯器只是第三個視圖，不要另外發明機制**（`core/view-host.ts:94`）
- [ ] T050 [US4] 執行結束時**清除兩側的高亮**
- [ ] T051 [US4] 在 Webview 面板加一小塊輸出區（⚠️ 它不是重點——使用者定調「執行的用意是高亮」）

**關卡（SC-007）**：單步 N 次，積木高亮換 N 次且程式碼側同步。

> **使用者現在多做得到什麼**：**看見程式在積木上一顆一顆走過去**。

---

## Phase 8：User Story 5 ＋ 7 —— 設定與視圖狀態（P2／P3）

- [ ] T052 [US5] 於 `src/vscode/manifest.ts` 宣告 `configuration`：target／topic／style／blockStyle／locale，🔴 **每一項都要 `scope: "language-overridable"`**（不宣告的話語言覆寫**安靜地不生效**）
- [ ] T053 [US5] 於 `src/vscode/panel.ts` 以 `{ uri, languageId }` 為範圍讀設定，交給 T019 的純函式解析後送 `config`
- [ ] T054 [US5] 訂閱設定變更 → 重新送 `config`（🔴 **老師改了，學生不用重開**）
- [ ] T055 [US5] 於 Webview 加組態選單，改它時送 `configChanged`；由主行程寫入 **workspace** 層級，⚠️ **而 UI 上要看得出「這會影響整個專案」**
- [ ] T056 [US7] 於 `src/vscode/panel.ts` 接上 T022 的視圖狀態：切換文件時存舊的、送新的
- [ ] T057 [US7] 🔴 處理**存檔那一刻的身分搬遷**（`untitled:` → `file://`）——⚠️ `onDidRenameFiles` 管不到它
- [ ] T058 [US5] 更新 `tools/vscode-preflight/run.mjs`：斷言組態有被套用（工具箱隨 target 改變）

**關卡（SC-008／010）**：語言覆寫生效；切走再回來原位。

> **使用者現在多做得到什麼**：**老師設一次全班一樣；切分頁不再重排**。

---

## Phase 9：User Story 8 —— 回歸（P1）

- [ ] T059 [P] [US8] `npm test` 全綠
- [ ] T060 [P] [US8] 🔴 `git diff --stat -- 'tests/**/baselines/*'` **是空的**（⚠️ 基線被改了就不是「沒退步」，是把尺改短）
- [ ] T061 [P] [US8] `npx vitest run tests/integration/audit-neutrality.test.ts` → `total` 仍是 **0**
- [ ] T062 [P] [US8] `npx vitest run tests/probes/arduino-realistic.test.ts` → 殘差 **0.07%**、漂移 **0/20**
- [ ] T063 [US8] `npx tsc --noEmit` 過，且**沒有動 `tsconfig` 的 `exclude`**
- [ ] T064 [US8] 🔴 驗證 **VSCode 這一側不呼叫 `core/storage.ts`**：`grep -rn "storage" src/vscode/` → 零筆（它在這裡是**消失**不是搬家）
- [ ] T065 [US8] 🔴 `grep -rn "setTimeout" src/vscode/` → **零筆**（FR-005）
- [ ] T066 [US8] 檢查 CSP 的 diff：**只多了 `'wasm-unsafe-eval'`**

**關卡（SC-011）**：八條全過。

---

## Phase 10：Polish ＋ 交棒

- [ ] T067 建置 ＋ 裝進 VSCode 與 Arduino IDE（版本號要動——🔴 改了 `contributes` 就要動，見 `manifest.ts` 檔頭）
- [ ] T068 跑 `node tools/vscode-preflight/run.mjs`，確認 console 錯誤 0、資源請求失敗 0
- [ ] T069 🔴 **交棒**：把 [quickstart.md](./quickstart.md) 第三節那張**七件事的表**補上實際的版本號與讀數欄位名 —— ⚠️ **這一項的產出是給使用者的指令，不是我打勾的驗收**
- [ ] T070 把撞到的坑逐條寫進 `knowledge/history/`，**含「因為知道答案而跳過的」**
- [ ] T071 更新 `knowledge/draft/2026-08-17-擴充要怎麼重做.md` 的出口條件；🔴 **若「防迴圈用身分」真的跑通了，才去改 `experience.md:2866`**（`research` 記著：在被實作之前它只是一個更好的猜測）
- [ ] T072 🔴 **使用者回報之後**：SC-001/002/003/004/006/007/010 的實測結果如實記錄——⚠️ **不得為了讓這一刀「完成」而換一個更弱的驗收**

---

## 依賴關係

```
Phase 1（T001–T002）    基準
      ↓
Phase 2（T003–T022）    🔴 阻斷全部——四塊純函式是後面七個故事的地基
      ↓
Phase 3（US6, T023–T028） 🔴 先做——後面每一步都要看得見
      ↓
Phase 4（US1, T029–T034） ← 需要 rewrite-span
      ↓
Phase 5（US2, T035–T041） ← 需要 echo-guard ＋ US1 的通道
      ↓
Phase 6（US3, T042–T046） ← 需要雙向的樹
      ↓
Phase 7（US4, T047–T051） ← 需要 US3 的高亮機制
      ↓
Phase 8（US5+US7, T052–T058） ← 需要 settings ＋ view-state
      ↓
Phase 9（US8, T059–T066）  ⚠️ 隨時可跑，而**放最後才有意義**
      ↓
Phase 10（T067–T072）
```

### 可平行的

```
T012–T015 / T017–T018 / T020–T021    三塊純函式的測試互不相干  [P]
T059 / T060 / T061 / T062            四條回歸互不相干          [P]
T043                                 高亮的單元測與 T044/T045 不同檔
```

🔴 **T023 不可與任何事平行** —— 它動到網頁版的共用檔，必須單獨可歸因。

---

## MVP 範圍

**Phase 1 → 2 → 3 → 4**（T001–T034）＝ **改積木，程式碼真的跟著變，而且只變那一段**。

⚠️ 而使用者拍板「一次做完」，所以 MVP **不是交付點**，只是**第一個可回報的里程碑**。

---

## 明確不做（不要生任務）

```
🔴 虛擬硬體 · inline DAP · 多面板／多文件 · 市集發佈
🔴 改 core/storage.ts —— ⚠️ 而 T064 要【驗證 VSCode 這一側不呼叫它】
   第一次編輯的排版重排（那是「呈現可丟失」那個分類的事，research 記著）
```
