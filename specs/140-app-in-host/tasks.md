# Tasks：擴充裡跑的就是網頁版本身

**Feature**: 140-app-in-host　**Date**: 2026-08-18
**Input**: [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md) · [contracts/code-view.md](./contracts/code-view.md) · [data-model.md](./data-model.md) · [quickstart.md](./quickstart.md)

---

## 🔴 讀這份清單之前：**這一刀的主要產出是【刪掉】**

```
會刪掉（重複或鷹架）                        約 1021 行
  webview/workspace-setup.ts  119   重複 app.ts 的 target→topic→toolbox
  webview/lift.ts             112   重複 app.ts:409-427 的 lift 管線
  webview/run.ts              102   重複 ExecutionController ＋ StepController
  webview/highlight.ts         97   重複 app.ts:598-612 的雙向高亮
  webview/main.ts             360 → 縮成薄殼
  pick-block.ts               103   第一刀的鷹架
  webview/fps.ts              128   🔴 儀器【搬家】不是丟掉

會新增                                      約 320 行
```

> **一次抽象如果沒有換掉任何資料，它換掉的是「誰有權知道什麼」
> ——而它的產出常常是【少了多少】，不是【多了什麼】。**

⚠️ 而**兩條驗收我勾不掉**：SC-001（人看得出是同一個產品）與
SC-003（每個控制項都有作用）。T041 是**交棒**。

---

## Phase 1：Setup

- [x] T001 記下基準：`npm test` 的測試數、`.vsix` 大小、`src/vscode/` 總行數（現況 2170）
- [x] T002 記下網頁版現況：`npm run dev` 開一次，**截圖存起來**——🔴 它是 SC-001 並排比對的左半邊

**關卡**：兩份基準都在。⚠️ **沒有「之前」的截圖，「之後像不像」就沒有比較對象。**

---

## Phase 2：Foundational —— 🔴 **先寫那條會毀損資料的測試**

- [x] T003 撰寫 `tests/integration/host-no-overwrite.test.ts`：宿主宣告「不還原文件內容」時，啟動流程 **一次都不呼叫 `setCode`**
- [x] T004 確認 T003 **紅**（宿主宣告還不存在）
- [x] T005 建立 `src/core/host/code-view.ts`：A/B/D 必要、C 可選 ＋ `absentReasons`（契約第一、二節）
- [x] T006 建立 `src/core/host/host-profile.ts`：`createCodeView` / `createStorage` / `features` / `featureReasons`（契約第四節）
- [x] T007 [P] 撰寫 `tests/integration/host-code-view-contract.test.ts`：🔴 **沒實作的可選方法**與 `absentReasons` 的鍵**必須一模一樣**（多一個是說謊，少一個是遺漏）
- [x] T008 [P] 撰寫 `tests/integration/host-profile-no-branch.test.ts`：🔴 `src/` 裡 grep `profile.id ===`／`\.id === '` → **零筆**（否則能力清單退化成標籤）

**關卡**：T003 紅、T007／T008 綠、`tsc` 過。

> **使用者現在多做得到什麼**：⚠️ **什麼都沒有**——而這是唯一一個不交付的階段。

---

## Phase 3：User Story 4 —— 網頁版一個像素都不能變（P1）🔴 **先做它**

**故事目標**：抽出介面，**而只讓網頁版用**。
**為什麼先做**：`history/072` 的病歷是「一條路徑全綠而另一條安靜地錯」。
🔴 **在只有一條路徑時把它驗乾淨，之後出問題才對得出來。**

- [x] T009 [US4] 於 `src/ui/panels/monaco-panel.ts` 宣告 `implements CodeView`——🔴 **行為零改動**，只是把既有方法對上介面
- [x] T010 [US4] 建立 `src/ui/host/web-profile.ts`：網頁版的宣告，🔴 **必須逐字等於今天的行為**（四個可選能力全部有、三個 feature 全開）
- [x] T011 [US4] 於 `src/ui/app.ts` 把 `monacoPanel` 的型別換成 `CodeView`（22 處），並改成從 profile 取得
- [x] T012 [US4] 於 `src/ui/app.ts:118` 把 `new StorageService()` 換成 `profile.createStorage()`
- [x] T013 [US4] 於 `src/ui/app-shell.ts` 接受 profile：`createCodeView` 取代直接 `new`，`features` 決定建不建行動版元件與檔案按鈕（8 處）
- [x] T014 [US4] 於 `src/ui/execution-controller.ts` 把 `ExecutionPanels` 的型別換成 `CodeView`（2 處）
- [x] T015 [US4] 於 `src/main.ts` 注入網頁版的 profile
- [x] T016 [US4] 跑 `npm test` ＋ 護欄 ＋ 探針 ＋ `tsc`
- [x] T017 [US4] 🔴 **`npm run dev` 開瀏覽器看一眼**，與 T002 的截圖比對——⚠️ **這一條不能省**

**關卡（SC-006）**：全套綠、基線零變動、中立性 0、探針不變、
🔴 **而且瀏覽器上看起來與 T002 一模一樣**。

> **測試綠不代表使用者看到的是對的。**

> **使用者現在多做得到什麼**：⚠️ **網頁版使用者：什麼都沒變**——**而那正是這一階段的成功。**

---

## Phase 4：User Story 3 —— 而他的檔案不能被弄壞（P1）

- [x] T018 [US3] 建立 `src/vscode/vscode-profile.ts`：`createStorage()` 回一個**不記文件內容**的實作（`save` 丟掉程式碼／樹／積木狀態；`load` 一律回空）
- [x] T019 [US3] 於同檔宣告 `features`：`fileButtons` / `mobileLayout` / `codeKeyboard` **全部關掉** ＋ `featureReasons` 各一句理由
- [x] T020 [US3] 確認 T003 **轉綠**

**關卡（SC-004）**：開機時 `setCode` 零次呼叫。

> **使用者現在多做得到什麼**：**他的檔案不會被蓋掉**——⚠️ 而那是一個「沒發生的事」，所以它靠測試看得見。

---

## Phase 5：User Story 1＋2 —— 面板就是網頁版（P1）

- [x] T021 [US1] 建立 `src/vscode/webview/vscode-code-view.ts`：實作 A/B/D；C 類不實作而在 `absentReasons` 寫理由
- [x] T022 [US1] 把 spec 139 的**文字鏡像 ＋ 樂觀更新 ＋ `baseVersion` 比對**從 `webview/main.ts` 搬進 T021（🔴 **搬不是重寫**）
- [x] T023 [US1] 把 spec 139 的**高亮轉送**（`revealNode` / `executionAt`）搬進 T021 的 `addHighlight` / `onExecutionAtNode`
- [x] T024 [US1] 把 spec 139 的**游標轉送**搬進 T021 的 `onCursorChange`
- [x] T025 [US1] 於 `src/vscode/webview-html.ts` 把 `#canvas`／`#readout`／`#bar`／`#out` 換成單一個 `#app`
- [x] T026 [US1] 把 `src/vscode/webview/main.ts` 縮成薄殼：建 profile → `new App(profile)` → `init()`
- [x] T027 [US2] 於 `src/vscode/panel.ts` 確認組態訊息接到 profile 的設定路徑（沿用 139 的 `config`）
- [x] T028 [US1] 建置 ＋ 預檢：確認**工具列／畫布／下方分頁／狀態列**都在，而**沒有程式碼編輯區**

**關卡（SC-002）**：預檢數得出四個區塊；console 錯誤 0。

> **使用者現在多做得到什麼**：**打開面板看到的就是他熟悉的那個介面。**

---

## Phase 6：🔴 刪除 —— **逐檔，各自一個 commit**

> ⚠️ 一次刪五個檔的 commit，出問題時對不出來。

- [x] T029 刪 `src/vscode/webview/workspace-setup.ts`（重複 `app.ts` 的組裝）＋ 跑預檢
- [x] T030 刪 `src/vscode/webview/lift.ts`（重複 `app.ts:409-427`）＋ 跑預檢
- [x] T031 刪 `src/vscode/webview/run.ts`（重複 `ExecutionController`）＋ 跑預檢
- [x] T032 刪 `src/vscode/webview/highlight.ts`（重複 `app.ts:598-612`）＋ 跑預檢
- [x] T033 刪 `src/vscode/pick-block.ts` ＋ `tests/integration/vscode-pick-block.test.ts`（第一刀的鷹架）
- [x] T034 🔴 `src/vscode/webview/fps.ts` **搬家不是刪**：量測改由宿主的輸出頻道呈現（FR-009）
- [x] T035 重新評估 `tests/integration/vscode-highlight.test.ts` 與 `vscode-toolbox-parity.test.ts`：⚠️ 被測的東西刪掉了 → **測試也要走**；而**它們守的性質若仍然重要，要說得出誰在守**

**關卡（SC-007）**：`src/vscode/` 行數從 2170 降到約 1150；面板組裝**一份**。

---

## Phase 7：User Story 5 —— 上一輪的能力一個都不能掉（P2）

- [x] T036 [P] [US5] 預檢驗：改一顆積木 → 只重寫改到的那一段
- [x] T037 [P] [US5] 預檢驗：貼一段程式 → 積木跟著出來**而且停下來**
- [x] T038 [P] [US5] 預檢驗：點積木／移游標 → 另一側跟著亮
- [x] T039 [US5] 預檢驗：單步 → 積木依序高亮（🔴 現在走的是 `ExecutionController`，不是我手寫的 runner）

**關卡（SC-005）**：五項全在。

---

## Phase 8：回歸 ＋ 交棒

- [x] T040 全套：`npm test` 全綠、基線零變動、中立性 0、探針不變、`tsc` 過、`src/vscode/` 的 `setTimeout` 零筆
- [x] T041 🔴 **交棒**：建置 ＋ 安裝，並**產出網頁版 ‖ 擴充的並排截圖**——⚠️ **SC-001 與 SC-003 由使用者判斷，不由我宣稱**
- [x] T042 把撞到的坑寫進 `knowledge/history/`，**含「因為知道答案而跳過的」**
- [x] T043 🔴 **使用者回報之後**：SC-001／SC-003 的結果如實記錄——⚠️ **不得為了讓這一刀「完成」而換一個更弱的驗收**

---

## 交棒結果（2026-08-18，使用者實測回報）

```
SC-001 人看得出是同一個產品      🟢 使用者未再提出「差這麼多」，並在兩個宿主上持續使用
SC-002 預檢數得出四個區塊         🟢（工具列／畫布／下方分頁／狀態列，console 錯誤 0）
SC-003 每個控制項都有作用         🟠 **部分**——目標／風格／語言／同步／清空／復原實測有作用；
                                    ⚠️ 執行與變數面板【使用者沒有測過】，不得記成通過
SC-004 開機不覆蓋檔案             🟢 測試釘住 ＋ 預檢「開 .ino 面板檔案一個字都沒改」
SC-005 spec 139 的能力全在        🟢 範圍編輯／回音／雙向高亮／單步都在
SC-006 網頁版零變化               🟢 三次截圖 MD5 逐位元組相同（963551d1…）
SC-007 src/vscode/ 行數下降        🟢 2170 → 1624
```

🔴 **交付之後使用者連續回報七個缺陷**，全部修完（0.4.2 → 0.7.0），
而其中三個是**修前一個時造成的**。因果與教訓寫在
[knowledge/history/083](../../knowledge/history/083-面板就是網頁版本身而四次修好都是我自己上一次修出來的.md)。

⚠️ **仍然開著**：`TypeError: … reading 'indexOf'`（只在 Theia 出現，
Chromium 用相同檔案內容重現不到）。它現在**不會毀損檔案**（`isStateStale` 擋住寫回），
而且會在面板上報出名字與堆疊。

---

## 依賴關係

```
Phase 1（T001–T002）   基準 ＋ 🔴 之前的截圖
      ↓
Phase 2（T003–T008）   🔴 先寫會毀損資料的那條測試；介面與宿主宣告
      ↓
Phase 3（US4, T009–T017）  🔴 抽介面而【只讓網頁版用】——最高風險的一步，隔離驗
      ↓
Phase 4（US3, T018–T020）  存檔服務 → T003 轉綠
      ↓
Phase 5（US1+US2, T021–T028）  宿主的實作 ＋ 啟動 App
      ↓
Phase 6（T029–T035）   🔴 刪除，逐檔
      ↓
Phase 7（US5, T036–T039）  能力回歸
      ↓
Phase 8（T040–T043）
```

### 可平行

```
T007 / T008        兩支契約測試，不同檔  [P]
T036–T038          三條預檢互不相干      [P]
```

🔴 **T009–T015 不可平行**：它們一起改動網頁版的核心，要能一次驗完再往下。

---

## MVP 範圍

**Phase 1 → 2 → 3**（T001–T017）＝ **介面抽出來了，而網頁版一個像素都沒變**。

⚠️ 它對使用者**什麼都沒交付**——🔴 **而它是這一刀風險最高的一段**，
所以它自成一個可驗的里程碑。

---

## 明確不做

```
🔴 抽 SyncController 的防迴圈 —— 拍板走 (i)：兩份並存
   理由：擴充那側的同步【性質真的不同】（跨行程、非同步、有外來變更），
   硬合成一份會做出一個兩邊都不好用的抽象
   ⚠️ 而那是【已知的重複】，要在程式碼裡標記成看得見的
🔴 虛擬硬體 · inline DAP · 多面板／多文件 · 市集發佈 · 行動版版面
🔴 改 Monaco 本身 · 重新設計介面（目標是「一樣」，不是「更好」）
```
