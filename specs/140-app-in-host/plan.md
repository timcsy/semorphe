# Implementation Plan：擴充裡跑的就是網頁版本身

**Branch**: `140-app-in-host` | **Date**: 2026-08-18 | **Spec**: [spec.md](./spec.md)

---

## Summary

把 `monacoPanel` 從**一個具體的編輯器**抽成**一個角色**（`CodeView`），
讓 `App` 只認識角色；再用一份 `HostProfile` 宣告「這個宿主有什麼／沒有什麼」。

於是擴充裡跑的**就是 `App` 本身**——工具列、選擇器、除錯工具列、
主控台、變數、狀態列、版面**全部跟著來**，而程式碼那一格由 IDE 的編輯器擔任。

🔴 **這一刀動網頁版的核心，所以「網頁版零變化」要在【每一步】驗，不是最後。**

---

## Technical Context

**Language/Version**: TypeScript 5.9（`strict` ＋ `verbatimModuleSyntax` ＋ `erasableSyntaxOnly`）

**Primary Dependencies**: 既有的 Blockly／Monaco／Vite／`@types/vscode`。**零新增。**

**Storage**：
```
網頁版      維持今天的行為（瀏覽器本地）
這個宿主    🔴 不記文件內容——檔案才是真相
```

**Testing**: Vitest（現況 4363）＋ Playwright ＋ Chromium 預檢。
🔴 **而 SC-001「看起來像不像」測不到**——交棒並附並排截圖。

**Target Platform**: VSCode 1.74+／Arduino IDE 2.x；網頁版不變

**Project Type**: 既有專案的一次**介面抽取**＋一個新的宿主組態

**Performance Goals**: 沿用——切分頁重建 ≤ 100 ms（量過的下界 13 ms）

**Constraints**:
- 🔴 網頁版**零變化**（全套綠 · 基線零變動 · 中立性 0 · 探針不變）
- 🔴 開機**零字元**的檔案變更
- 面板組裝**一份**（不是兩份）
- `src/vscode/` 的 `setTimeout` 仍是零筆

**Scale/Scope**: 30 處呼叫點 · 2 個宿主 · 1 份組裝

---

## Constitution Check

| 原則 | 判定 | 依據 |
|---|---|---|
| **I. 簡約優先** | 🟢 通過 | 這一刀**拿掉**東西比加得多：手工殼、診斷讀數、重複的組裝全部消失。⚠️ 新增的只有一個介面與一份宿主宣告 |
| **II. TDD** | 🟡 **部分** | 🔴 FR-004（開機不覆蓋檔案）**必須先寫測試**；介面契約也測得到。⚠️ 而「看起來像不像」測不到——**明說並交棒** |
| **III. Git 紀律** | 🟢 通過 | 🔴 **抽介面**與**接宿主**分成不同 commit，讓網頁版的回歸對得出來 |
| **IV. 規格文件保護** | 🟢 通過 | |
| **V. 繁體中文優先** | 🟢 通過 | |

### 🔴 Post-Design 重驗

| 原則 | 重驗 | 結果 |
|---|---|---|
| I. 簡約 | 設計後多出什麼？ | 🟢 一個介面 ＋ 一份宿主宣告；**而它換掉了 30 處對具體編輯器的直接依賴** |
| II. TDD | 可測面積變大了嗎？ | 🟢 **變大**：`CodeView` 可以用假實作驗，而「App 有沒有呼叫這個宿主沒有的能力」因此**測得到** |
| III. Git | 最高風險的一步隔離了嗎？ | 🟢 抽介面（只讓網頁版用）自成一階段，**跑完全套才往下** |

---

## Project Structure

```text
src/
├── core/host/
│   ├── code-view.ts        ★ 角色的介面（A/B/D 必要，C 可選 ＋ absentReasons）
│   └── host-profile.ts     ★ 這個宿主有什麼／沒有什麼（＋ featureReasons）
├── ui/
│   ├── app.ts              ⚠️ 改成依賴 CodeView 與 HostProfile（22 處）
│   ├── app-shell.ts        ⚠️ 同上（8 處）＋ 由 features 決定建不建行動版元件
│   ├── execution-controller.ts  ⚠️ ExecutionPanels 的型別換成 CodeView（2 處）
│   ├── panels/monaco-panel.ts   ⚠️ 宣告 implements CodeView（🔴 行為零改動）
│   └── host/web-profile.ts      ★ 網頁版的宣告——**必須逐字等於今天的行為**
└── vscode/
    ├── webview/
    │   ├── main.ts             ⚠️ 改成啟動 App（拆掉手工殼）
    │   ├── vscode-code-view.ts ★ 把文字交給宿主的實作（沿用 139 的鏡像與樂觀更新）
    │   └── vscode-profile.ts   ★ 這個宿主的宣告
    ├── sync/*                  🟢 沿用（echo-guard／settings／view-state／messages）
    └── panel.ts                🟢 沿用宿主側接線

tests/integration/
├── host-code-view-contract.test.ts  ★ 缺的可選方法必須有理由
├── host-no-overwrite.test.ts        ★ 🔴 FR-004：開機不得呼叫 setCode
└── host-profile-no-branch.test.ts   ★ 🔴 不得出現 `profile.id === '…'` 的分支
```

**Structure Decision**：介面放 `src/core/host/`——🟢 **它不認識任何宿主**
（中立性護欄掃 `src/core`，而這個介面裡不會有任何宿主的名字）。
宿主的**宣告**各自放在自己那一側。

---

## 實作階段

> 🔴 **每一階段結束都要能回答「網頁版還一樣嗎」。**
> `history/072` 的病歷是「一條路徑全綠而另一條安靜地錯」。

### Phase A —— 先寫那條會毀損資料的測試（🔴 **它必須先紅**）

```
host-no-overwrite   餵一個「存檔裡有程式碼」的假儲存 → 斷言 setCode 零次呼叫
```

⚠️ **現在它會綠**（因為網頁版本來就該還原）——所以測試要**針對宿主宣告**：
「當宿主宣告不還原文件內容時，`setCode` 零次」。**先讓那個宣告不存在而測試紅。**

**出口**：測試存在且**紅**。

### Phase B —— 抽介面，而**只讓網頁版用**

```
core/host/code-view.ts       角色的介面
core/host/host-profile.ts    宿主的宣告
ui/host/web-profile.ts       網頁版：逐字等於今天
monaco-panel.ts              implements CodeView（行為零改動）
app.ts / app-shell.ts / execution-controller.ts   換型別，注入 profile
```

🔴 **出口（本輪最重要的一道關卡）**：
```
npm test 全綠 · 基線零變動 · 中立性 0 · 探針不變
🔴 而且【開瀏覽器看一眼】——測試綠不代表使用者看到的是對的
```
⚠️ 最後那一條是這個專案的明文教訓（memory：「重構後開瀏覽器實測」）。

### Phase C —— 宿主的實作

```
vscode/webview/vscode-code-view.ts   把 139 的鏡像／樂觀更新／高亮搬進來
vscode/webview/vscode-profile.ts     features 全部宣告 ＋ 理由
```

**出口**：Phase A 的測試**轉綠**。

### Phase D —— Webview 改成啟動 `App`

```
拆掉 #canvas / #readout / #bar / #out，改成一個 #app
診斷讀數搬進宿主的輸出頻道（FR-009）
```

**出口**：預檢看得到工具列／畫布／下方分頁／狀態列；console 錯誤 0。

### Phase E —— 能力回歸 ＋ 交棒

```
139 的五項能力逐條再驗
🔴 並排截圖（網頁版 ‖ 擴充）—— 而 SC-001 由使用者判斷
```

---

## 🔴 驗證的分工

| 類別 | 誰 | 怎麼驗 |
|---|---|---|
| 網頁版零變化 | 🟢 我 | 全套 ＋ 護欄 ＋ 探針 ＋ **開瀏覽器看** |
| 開機不覆蓋檔案 | 🟢 我 | 單元測 |
| 介面契約（缺的要有理由、不得用 id 分支） | 🟢 我 | 單元測 |
| 面板有哪些區塊 | 🟢 我 | Chromium 預檢數 DOM |
| **「看起來像不像」** | 🔴 **使用者** | 並排截圖 |
| **工具列每個控制項都有作用** | 🔴 **使用者** | 在 IDE 裡逐一按 |

> **一個「像不像」的驗收，換成「有幾個區塊」就不再是同一條驗收了。**

---

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| **動 `app.ts`／`app-shell.ts`（網頁版核心）** | 使用者要「擴充裡跑的就是網頁版」，而那要求兩邊**共用同一份組裝** | 「Webview 裡另組一份」——❌ 使用者已否決；而兩份組裝會漂移，`history/072` 正是那個病。🟢 處置：抽介面自成一階段，跑完全套＋開瀏覽器才往下 |
| **憲法 II：SC-001 測不到** | 「看起來像不像」是人的判斷 | 「換成『有幾個區塊』」——❌ 那已經不是同一條驗收。🟢 處置：SC-002 測區塊數，**而 SC-001 保留給人**，並附並排截圖讓判斷有依據 |
| **新增一個介面 ＋ 一份宿主宣告** | 30 處直接依賴一個具體編輯器 | 「在呼叫點加 `if`」——❌ 那讓「這個宿主缺什麼」散落各處，而**每個新宿主都要把那些 `if` 各撞一次**（`component-generate` skill 記過同形的病） |
| **可選方法 ＋ `absentReasons`（而不是空實作）** | C 類在這個宿主沒有意義 | 「實作成 noop」——❌ 專案明令：**顯式的空與遺漏的空要分得出來，而一個 noop 兩者長得一樣** |
