# Tasks：擴充的第一刀——在 Arduino IDE 裡畫得出一顆積木

**Feature**: 138-vscode-first-block　**Date**: 2026-08-17
**Input**: [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md) · [contracts/webview-host.md](./contracts/webview-host.md) · [data-model.md](./data-model.md) · [quickstart.md](./quickstart.md)

---

## 🔴 讀這份清單之前要知道的一件事

**這一刀的性質是否證。** 有兩條驗收（SC-002／SC-004）**我勾不掉**
——它們要在真的 Arduino IDE 裡拖曳，而那是桌面應用。

所以 **T027 是「交棒」不是「驗收」**：它的產出是一份**使用者照著念就好**的指令，
而不是一個我自己打勾的項目。

> **而如果畫布跑不動，這一刀仍然成功**（SC-007）——
> 條件是如實記下來，**不換一個更弱的驗收**。

---

## Phase 1：Setup —— 🔴 **最早的失敗點先撞**

**目標**：讓 `tsc` 認得 `vscode`。
**為什麼第一**：research 第五節標了一個未驗——`tsconfig` 的
`"types": ["vite/client"]` 會不會讓 `import 'vscode'` 找不到型別。
**這裡兩分鐘就知道；擺到最後才發現的話，前面全部要重做。**

- [ ] T001 安裝 `@types/vscode` 與 `@vscode/vsce` 到 devDependencies（`package.json`）
- [ ] T002 建立 `src/vscode/extension.ts`，只寫 `import * as vscode from 'vscode'` ＋ 空的 `activate`／`deactivate`
- [ ] T003 🔴 執行 `npx tsc --noEmit` —— **不得動 `tsconfig.json` 的 `exclude`**。若找不到 `vscode` 型別，改為把 `"vscode"` 加進 `compilerOptions.types`（`tsconfig.json`），並把結果記進 `research.md` 第五節那個「未驗」欄位
- [ ] T004 在 `.gitignore` 加入 `build/`（產物目錄）

**關卡**：`npx tsc --noEmit` 過，且 `exclude` 一個字沒改。

⚠️ **T003 不論結果如何都要回填 `research.md`** —— 一個標成「未驗」的東西驗完
沒有人回去改，下一輪會把它當未知重推（`history/080`§一 記過同一個病）。

---

## Phase 2：Foundational —— 挑積木的那個純函式（**唯一能 TDD 的一塊**）

**目標**：把「畫哪一顆」變成一個**可單元測的純函式**。
**憲法 II**：測試先寫，Red → Green。
**契約**：[contracts/webview-host.md](./contracts/webview-host.md) 第五節。

- [ ] T005 撰寫 `src/vscode/pick-block.test.ts`：斷言 `initCppModule()` 的登錄表載得到 **≥ 200** 顆膠囊、spec 數 > 0（**正向錨點——先證明量到了東西**）
- [ ] T006 於 `src/vscode/pick-block.test.ts` 加：`pickSimplestBlock` 只回傳**中性形態**（`form` 未宣告）且**有 `previousStatement` 或 `nextStatement`** 的 spec
- [ ] T007 🔴 於 `src/vscode/pick-block.test.ts` 加：**把輸入陣列打亂後結果不變**（對載入順序不敏感）
- [ ] T008 於 `src/vscode/pick-block.test.ts` 加：**空輸入拋錯**，不回 `undefined`
- [ ] T009 確認 T005–T008 全部 **Red**（函式還不存在）
- [ ] T010 實作 `src/vscode/pick-block.ts` 的 `pickSimplestBlock(specs)`：`args0` 長度最小者勝，同分取 `blockDef.type` 字典序最小
- [ ] T011 確認 T005–T008 全部 **Green**

**關卡**：新測試綠；🔴 **`src/vscode/pick-block.ts` 裡零個 conceptId 字串**
（判準全部是結構性的——那既是 FR-004 要的，也是第二十八條護欄在看的）。

⚠️ **T007 有病歷**：`lift-branches.ts:26` 逐字「登錄順序來自
`import.meta.glob` 的檔名排序，**那不是任何人設計的**」。
**一個依賴載入順序的挑選，會在有人新增一顆膠囊的那天安靜地換一顆積木。**

---

## Phase 3：User Story 1 —— 學生在他已經在的地方看到積木（P1）

**故事目標**：`.vsix` 裝得上、面板打得開、畫布上有一顆**來自登錄表**的積木。
**獨立測試**：`.vsix` 丟進 `~/.arduinoIDE/plugins` → 重開 → 面板有積木。

### Webview 那一側（先在瀏覽器裡證明它會動）

- [ ] T012 [US1] 建立 `src/vscode/webview/main.ts`：呼叫 `initCppModule()` → `new BlockRegistrar(registry).registerAll(...)` → `Blockly.inject`，並用 `pickSimplestBlock` 放一顆積木上畫布
- [ ] T013 [US1] 於 `src/vscode/webview/main.ts` 加畫面讀數：膠囊數／spec 數／畫布上那顆的 `blockDef.type` 與 `conceptId`（資料形狀見 [data-model.md](./data-model.md) 第二節）
- [ ] T014 [US1] 🔴 `Blockly.inject` 的 `media` 讀 `window.__SEMORPHE_BLOCKLY_MEDIA__`（契約第二節）——⚠️ **尾端斜線要顯式補**，少一個就變成 `.../mediasprites.png`
- [ ] T015 [US1] 建立 `vite.vscode.config.ts` 的 **webview 目標**（ESM／browser／輸出 `build/vscode/dist/webview.js`），以 `process.env.SEMORPHE_VSCODE_TARGET` 分岔
- [ ] T016 [US1] 🔴 在 Chromium 裡開起來，確認三件事：**膠囊數 ≥ 200**、畫布上有積木、`conceptId` 顯示得出來

⚠️ **T016 的膠囊數是「核搬過去了沒」的證據** ——
esbuild 那次它是 0（`registry.ts:31`：「189 顆膠囊**一顆都沒被打包進去**」），
**而它建得出來、只發一則 warning**。

### 擴充殼與打包

- [ ] T017 [US1] 建立 `src/vscode/manifest.ts`：匯出擴充宣告物件（`publisher`／`engines.vscode: ^1.74.0`／`main`／`contributes.viewsContainers` ＋ `views`／`activationEvents: ['onStartupFinished']`）
- [ ] T018 [US1] 建立 `src/vscode/panel.ts`：建 Webview、`asWebviewUri` 算 media 根、`localResourceRoots` 指向擴充產出目錄、注入 `window.__SEMORPHE_BLOCKLY_MEDIA__`
- [ ] T019 [US1] 🔴 於 `src/vscode/panel.ts` 組 CSP 四條（契約第三節）——⚠️ **`img-src ${cspSource} data:` 不可漏**，`block-registrar.ts:291` 的 `+`／`-` 按鈕是 data URI
- [ ] T020 [US1] 於 `src/vscode/extension.ts` 註冊視圖提供者，把 T018 的面板接上
- [ ] T021 [US1] 於 `vite.vscode.config.ts` 加 **extension 目標**（CJS／node／`vscode` external／輸出 `build/vscode/dist/extension.js`）
- [ ] T022 [US1] 建立 `src/scripts/build-vscode.ts`：由 `manifest.ts` 寫出 `build/vscode/package.json`、從 `node_modules/blockly/media` 複製 media、依序跑兩個 Vite 目標、呼叫 `vsce package`
- [ ] T023 [US1] 於 `package.json` 加 `"build:vscode"` script，執行後產出一個 `.vsix`

**故事關卡**：`npm run build:vscode` 產出 `.vsix`（SC-001）；
T016 的三條在 Chromium 裡成立（SC-003 的一半）。

---

## Phase 4：User Story 2 —— 而它要跑得順，不只是畫得出來（P1）

**故事目標**：「順不順」有一個**寫得出來的判準**與一個結論（SC-004）。
**獨立測試**：拖一顆積木橫跨畫布，畫面上出現數字。

- [ ] T024 [US2] 建立 `src/vscode/webview/fps.ts`：Blockly 拖曳期間以 `requestAnimationFrame` 記幀間隔，輸出幀數／中位數／p95／最大
- [ ] T025 [US2] 🔴 於 `src/vscode/webview/fps.ts` 由數字算出 `verdict`：中位數 ≤ 20 ms 且 p95 ≤ 33 ms → 順；中位數 > 33 ms 或 p95 > 100 ms → 不順；之間 → 勉強。⚠️ **`verdict` 不得由人填**
- [ ] T026 [US2] 於 `src/vscode/webview/main.ts` 把 T024/T025 的讀數接上畫面，並在 Chromium 裡拖一次拿到基準數字
- [ ] T027 [US2] 🔴 **交棒**：把安裝指令與「要念的三個數字」寫進 [quickstart.md](./quickstart.md) 第四節（已有骨架，補上實際的 `.vsix` 檔名與截圖位置）——⚠️ **這一項的產出是給使用者的指令，不是一個我打勾的驗收**

**故事關卡**：判準寫得出來、Chromium 有一組數字、交棒文件可照著做。

> 🔴 **T026 的數字是 Chromium 的，不是 Arduino IDE 的。**
> 混為一談就是 `history/076` 那個錯的形狀（在 A 環境驗、宣稱 B 環境成立）。

---

## Phase 5：User Story 3 —— 而網頁版一個字都不能退步（P1）

**故事目標**：加一個宿主而舊的沒有安靜地壞掉。
**為什麼是一個獨立的故事**：這個專案付過那個學費
（`history/072`：`c-style-parity` 10/10 全綠，**而瀏覽器上仍然產出 `<iostream>`**）。

- [ ] T028 [P] [US3] 執行 `npm test`，確認 **4283 全綠**
- [ ] T029 [P] [US3] 確認 **47 條護欄基線檔一個數字都沒被改**（`git diff` 看 `tests/**/baselines/`）
- [ ] T030 [P] [US3] 執行 `npx vitest run tests/integration/audit-neutrality.test.ts`，確認 `total` 仍是 **0**
- [ ] T031 [P] [US3] 執行 `npx vitest run tests/probes/arduino-realistic.test.ts`，確認殘差 **0.07%**、漂移 **0/20**
- [ ] T032 [US3] 執行 `npx tsc --noEmit`，確認涵蓋 `src/vscode/` 且**沒有靠 exclude 過關**

**故事關卡**：五條全過。
⚠️ **基線被改了就不是「沒退步」，是「把尺改短了」**（T029）。

---

## Phase 6：Polish & 收尾

- [ ] T033 刪除 `vscode-ext/`（上一個原型的**零追蹤產物殘骸**，`git ls-files vscode-ext` 為空）——⚠️ **這是本輪唯一超出 spec 範圍的動作**，理由：`history/069`§四 逐字「一個原型……**它會偽裝成『已經有基礎』**」
- [ ] T034 把撞到的坑逐條寫進 `knowledge/history/`，**含「因為知道答案而跳過的」**
- [ ] T035 🔴 若畫布在 Arduino IDE 裡跑不動，**如實記錄並保留原驗收**（SC-007）——⚠️ **不得為了讓這一刀「完成」而換一個更弱的判準**
- [ ] T036 更新 `knowledge/draft/2026-08-17-擴充的形狀.md` 的出口條件：第一刀跑過了沒、`src/vscode/` 那一刀已拍板

---

## 依賴關係

```
Phase 1（T001–T004）  🔴 阻斷全部——tsc 不認得 vscode 就什麼都不用做
      ↓
Phase 2（T005–T011）  阻斷 US1——沒有 pickSimplestBlock 就畫不出「來自登錄表」的積木
      ↓
Phase 3（US1, T012–T023）
      ↓
Phase 4（US2, T024–T027）   依賴 US1 的 webview 存在
      ↓
Phase 5（US3, T028–T032）   ⚠️ 其實隨時可跑，但**放最後才有意義**——
                            要驗的是「全部做完之後網頁版還是好的」
      ↓
Phase 6（T033–T036）
```

### 可平行的

```
T028 / T029 / T030 / T031     四條回歸互不相干  [P]
T017 與 T012–T016             manifest 與 webview 不同檔，可並行
```

⚠️ **T018 / T019 / T020 不可平行**——都動 panel／extension 的接線。

---

## MVP 範圍

**Phase 1 → 2 → 3**（T001–T023）＝ **一個能裝、打得開、有一顆真積木的 `.vsix`**。

而 **Phase 4 才是這一刀真正的目的**——
MVP 交得出來卻沒有數字的話，這一刀什麼都沒否證。

---

## 明確不做（不要生出任務）

```
🔴 雙向同步、寫回 TextDocument、讀 .ino
🔴 per-document 那 18 個欄位
   monacoPanel 的 21 處
   工具箱、執行、診斷、多文件、市集發佈
```
