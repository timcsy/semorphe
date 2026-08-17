# Implementation Plan：擴充的第一刀——在 Arduino IDE 裡畫得出一顆積木

**Branch**: `138-vscode-first-block` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/138-vscode-first-block/spec.md`

---

## Summary

在 `src/vscode/` 蓋一個擴充骨架，打包成 `.vsix`，裡面一個 Webview 面板
用**既有的膠囊登錄表**畫出一顆真的 Semorphe 積木——
然後**去量它在 Arduino IDE 裡跑不跑得順**。

🔴 **這一刀的性質是否證**：如果畫布在 Arduino IDE 裡卡，那是本輪最有價值的產出。

技術路線由 [research.md](./research.md) 決定，而其中兩條是**既有程式碼已經寫好答案的**：

```
① Webview 用 Vite browser build  →  🟢 繞開 esbuild/CJS 那個 4.6 KB 的坑
② 積木從登錄表挑，不寫死身分      →  🟢 護欄與 FR-004 指向同一件事
```

---

## Technical Context

**Language/Version**: TypeScript 5.9（`~5.9.3`），`strict` ＋ `verbatimModuleSyntax` ＋ `erasableSyntaxOnly`

**Primary Dependencies**: Blockly 12.4.1（既有）· Vite 7.3.1（既有）
· **新增** `@types/vscode`、`@vscode/vsce`（皆 devDependency）

**Storage**: N/A —— 🔴 本輪**不存任何東西**（`storageService` 的 per-uri 化明確排除）

**Testing**: Vitest（現況 4283）· Playwright（e2e）
⚠️ **而本輪最關鍵的兩條驗收沒有自動化測試**——見「驗證的分工」

**Target Platform**: Arduino IDE 2.x（Theia／Electron，吃 VSCode 擴充）· 次要：VSCode

**Project Type**: 既有單一專案 ＋ 一個新的宿主層目錄（`src/vscode/`）

**Performance Goals**: 🔴 **本輪建立第一個**——拖曳幀間隔中位數 ≤ 20 ms、p95 ≤ 33 ms
（判準與量法見 research.md 第七節。⚠️ 它是**探測**不是護欄，因為沒有既有基準）

**Constraints**:
- 網頁版零行為改變（4283 全綠 · 47 條基線零變動 · 中立性 `total` 仍是 0）
- 探針不得退步（殘差 0.07% · 漂移 0/20）
- `npx tsc --noEmit` 必須涵蓋 `src/vscode/`，**不得靠 exclude 過關**

**Scale/Scope**: 一個面板 · 一顆積木 · 200 顆膠囊要載得進 Webview

---

## Constitution Check

*GATE: 必須在 Phase 0 之前通過，Phase 1 之後重驗。*

| 原則 | 判定 | 依據 |
|---|---|---|
| **I. 簡約優先** | 🟢 通過 | 明確排除 8 項（雙向同步／per-document／`monacoPanel` 21 處／工具箱／執行／診斷／多文件／市集）。⚠️ 而 research 第三節**刻意選了「照單全收 `BlockRegistrar`」而不是挑三揀四**——挑選會製造一份清單，那才是複雜度 |
| **II. TDD（非妥協）** | ⚠️ **部分適用，理由如下** | 見下方「Complexity Tracking」第一列 |
| **III. Git 紀律** | 🟢 通過 | 每個 Phase 一個 commit |
| **IV. 規格文件保護** | 🟢 通過 | 不碰 `specs/`、`.specify/`。⚠️ 唯一的刪除動作是 `vscode-ext/`（**零追蹤的產物殘骸**，research 第八節） |
| **V. 繁體中文優先** | 🟢 通過 | 本檔與所有 spec 文件皆繁中 |

### 🔴 Post-Design 重驗（Phase 1 之後）

| 原則 | 重驗 | 結果 |
|---|---|---|
| I. 簡約 | 設計後有沒有多出東西？ | ⚠️ 多了 `manifest.ts`（research 第五節 (c)）。**理由是避開 `src` 底下的 `.json` 被 5 條護欄掃到**，不是為了漂亮 |
| II. TDD | 設計有沒有讓可測的部分變多？ | 🟢 **有**：「挑哪顆積木」被設計成一個**純函式**（登錄表 → spec），於是它 100% 可單元測 |
| III–V | 無變動 | 🟢 |

---

## Project Structure

### Documentation (this feature)

```text
specs/138-vscode-first-block/
├── spec.md              ✅ 已完成
├── checklists/
│   └── requirements.md  ✅ 已完成（16 項全過）
├── plan.md              ← 本檔
├── research.md          ✅ Phase 0
├── data-model.md        ✅ Phase 1
├── contracts/
│   └── webview-host.md  ✅ Phase 1
├── quickstart.md        ✅ Phase 1
└── tasks.md             ← /speckit-tasks 產出
```

### Source Code (repository root)

```text
src/
├── components/          （200 顆膠囊，不動）
├── core/                （不動——中立性 total 必須維持 0）
├── ui/                  （不動——🔴 App 的 31 個欄位一個都不碰）
├── languages/           （不動）
└── vscode/              ★ 本輪新增，🔴 而它在 `src` 底下是刻意的
    ├── manifest.ts          擴充的宣告（建置時寫成 package.json）
    ├── extension.ts         主行程進入點：註冊指令、開面板
    ├── panel.ts             建 Webview、算 URI、組 CSP、產 HTML
    ├── pick-block.ts         ★ 純函式：登錄表 → 要畫的那顆 spec
    ├── pick-block.test.ts    ★ 它的測試（可單元測的那一塊）
    └── webview/
        ├── main.ts          Webview 進入點：initCppModule → BlockRegistrar → inject
        └── fps.ts           拖曳幀間隔量測 ＋ 畫面上的讀數

src/scripts/
└── build-vscode.ts      ★ 寫 package.json、複製 media、呼叫 vsce

vite.vscode.config.ts    ★ 一份設定、兩個目標（SEMORPHE_VSCODE_TARGET）
build/vscode/            ★ 產物（進 .gitignore）
```

**Structure Decision**：`src/vscode/`。

理由**不是**「比較整齊」，是：

> **把新程式碼放在護欄看不到的地方，等於替它辦一張免檢證。**

而 research 第二節把 draft 的「3 支護欄」更正為 **6 條 ＋ 1 個共用 helper**
——那讓這個決定更強。

⚠️ **而它有一個立刻生效的後果**（不是負擔，是設計指引）：
`src/vscode/` **不得出現任何 conceptId 字串**，否則第二十八條護欄會叫。
**於是「那顆積木必須從登錄表挑」從一句規格變成一條會紅的檢查。**

---

## 實作階段

### Phase A —— 讓 `tsc` 認得 `vscode`（**最早的失敗點**）

```
安裝 @types/vscode ＋ @vscode/vsce
寫一個只有 activate/deactivate 的 src/vscode/extension.ts
跑 npx tsc --noEmit
```

🔴 **這一步先做是刻意的**：research 第五節標了一個未驗
——`tsconfig` 的 `"types": ["vite/client"]` 會不會讓 `import 'vscode'` 找不到型別。
**如果會，這裡兩分鐘就知道；擺到最後才發現的話，前面全部要重做。**

**出口**：`npx tsc --noEmit` 過，而且**沒有動 `exclude`**。

### Phase B —— 挑積木的那個純函式（**唯一能 TDD 的一塊，所以先寫測試**）

```
1. 先寫 src/vscode/pick-block.test.ts（Red）
   · 登錄表載得到 ≥ 200 顆膠囊
   · pickSimplestBlock(specs) 回傳決定性的結果（同輸入同輸出）
   · 🔴 它不依賴載入順序——把 specs 打亂後結果不變
2. 實作 pick-block.ts（Green）
```

⚠️ **「打亂後結果不變」那一條是有病歷的**：`lift-branches.ts:26` 逐字
「登錄順序來自 `import.meta.glob` 的檔名排序，**那不是任何人設計的**」。

**出口**：新測試綠，總數 4283 → 4283+N。

### Phase C —— Webview 那一側（先在**瀏覽器**裡證明它會動）

```
1. src/vscode/webview/main.ts：initCppModule() → BlockRegistrar → Blockly.inject
2. src/vscode/webview/fps.ts：幀間隔量測 ＋ 畫面讀數
3. vite.vscode.config.ts（webview 目標，ESM/browser）
4. 🔴 用既有的 Playwright 開一個本機頁面載它 —— 證明：
   · 登錄表載進去了（讀數顯示膠囊數 ≥ 200）
   · 畫布上有一顆積木，而它的 conceptId 顯示得出來
   · 拖曳量得到數字
```

🟢 **這一步在瀏覽器裡做完，Arduino IDE 那一步就只剩「宿主差異」一個變因。**
⚠️ 而 research 第七節說清楚了：**瀏覽器的數字不是 Arduino IDE 的結論**。

**出口**：`build/vscode/dist/webview.js` 建得出來，且在 Chromium 裡三條都成立。

### Phase D —— 擴充殼與 `.vsix`

```
1. src/vscode/manifest.ts（publisher/engines/main/contributes.viewsContainers+views）
2. src/vscode/panel.ts（CSP 四條 ＋ media URI ＋ localResourceRoots）
3. vite.vscode.config.ts 的 extension 目標（CJS/node/'vscode' external）
4. src/scripts/build-vscode.ts：寫 package.json、複製 blockly media、跑 vsce package
5. npm script：build:vscode
```

⚠️ **CSP 的 `img-src data:` 不要漏**（research 第四節②）——漏了的症狀是
「`+`／`-` 按鈕變破圖而功能還在」，**安靜地壞**。

**出口**：`npm run build:vscode` 產出一個 `.vsix`（SC-001）。

### Phase E —— 回歸與交棒

```
1. npm test          → 4283 全綠、47 條基線零變動、中立性 total = 0
2. npx tsc --noEmit  → 過
3. 探針              → 殘差 0.07%、漂移 0/20
4. 刪 vscode-ext/    （research 第八節，零追蹤的殘骸）
5. 🔴 交棒給使用者：裝進 ~/.arduinoIDE/plugins、重開、拖一下、念數字
```

---

## 🔴 驗證的分工——**現在講清楚，不要事後才承認**

| 驗收 | 誰能驗 | 怎麼驗 |
|---|---|---|
| SC-001 `.vsix` 產得出來 | 🟢 我 | `npm run build:vscode` |
| SC-003 積木來自登錄表 | 🟢 我 | Phase B 的單元測 ＋ Chromium 讀數 |
| SC-005 網頁版不退步 | 🟢 我 | `npm test` |
| SC-006 探針不退步 | 🟢 我 | 探針 |
| SC-007 如實記錄 | 🟢 我 | history／experience |
| **SC-002 面板在 Arduino IDE 打得開** | 🔴 **使用者** | 裝上、重開、看 |
| **SC-004 畫布在 Arduino IDE 順不順** | 🔴 **使用者** | 拖一下、把畫面上的數字念出來 |

> **我做不到的是「在 Electron 桌面應用裡拖曳」，不是「量不出來」。**
> 所以交付物包含一個**自己會報數字的畫面**——
> 讓那一步只需要念數字，不需要任何判斷。

⚠️ 而如果數字顯示「不順」，**那就是 SC-007 說的成功的否證**——
`history` 要如實記，**不換一個更弱的驗收**。

---

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| **憲法 II「測試 MUST 在實作之前」只在 Phase B 完整成立** | 本輪的核心產出是「一個 Webview 在別人的桌面應用裡跑不跑得動」。⚠️ **那個東西沒有可以先寫的測試**——它的 oracle 是使用者的眼睛與手 | 「先寫一個 e2e 測試」——❌ 我們**驅動不了 Arduino IDE**（research 第七節）。寫一個 Chromium 的 e2e 然後宣稱它覆蓋 Arduino IDE，正是 `history/076` 那個錯的形狀（在 A 環境驗、宣稱 B 環境成立）。🟢 **處置**：把**測得到的那一塊切出來先 TDD**（Phase B 的 `pick-block`），測不到的那一塊**明說測不到**，見上表 |
| **多一個 `manifest.ts`** | `.vsix` 需要擴充自己的 `package.json`，而根目錄那份是網頁版的 | (a) 加進根 `package.json` → 汙染網頁版宣告；(b) `src/vscode/package.json` → ⚠️ `src` 底下的 `.json` 被 5 條護欄掃到。(c) 讓宣告是 TypeScript ⟹ 受同一套檢查 |
| **多一份 Vite 設定** | 兩個產出目標相反（CJS/node/external vs ESM/browser/bundle） | 兩份設定檔 → 會各自漂移，而它們一半設定共用。改用**一份 ＋ 目標分岔** |
| **刪 `vscode-ext/`（超出 spec 範圍）** | 它是上一個原型的**零追蹤產物殘骸**，而 `history/069`§四 逐字記過「原型會偽裝成『已經有基礎』」 | 「留著不管」——⚠️ 下一個做這條路的人會以為有基礎。**這是本輪唯一超範圍的動作，寫在這裡以便反悔** |
