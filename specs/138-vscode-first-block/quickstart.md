# Quickstart：怎麼驗這一刀

**Feature**: 138-vscode-first-block　**Date**: 2026-08-17

---

## 前置

```bash
cd /Users/timcsy/Documents/Projects/semorphe
npm install          # @types/vscode ＋ @vscode/vsce 是本輪新增的
```

---

## 一、我驗得到的五條（自動）

```bash
# ① 型別——🔴 必須涵蓋 src/vscode/，不得靠 exclude 過關
npx tsc --noEmit

# ② 挑積木的純函式（Phase B）
npx vitest run src/vscode/pick-block.test.ts

# ③ 全套回歸——4283 全綠、47 條基線零變動
npm test

# ④ 中立性仍是 0
npx vitest run tests/integration/audit-neutrality.test.ts

# ⑤ 探針不得退步——殘差 0.07%、漂移 0/20
npx vitest run tests/probes/arduino-realistic.test.ts
```

**期望**：五條全過，而且 ③ 的**基線檔一個字都沒被改**
（⚠️ 基線被改了就不是「沒退步」，是「把尺改短了」）。

---

## 二、打包

```bash
npm run build:vscode
ls -la build/vscode/*.vsix
```

**期望**：一個 `.vsix`（SC-001，今天是 0 個）。

---

## 三、Chromium 裡的預檢（⚠️ **不是** Arduino IDE 的結論）

```bash
node tools/vscode-preflight/run.mjs --shot /tmp/preflight.png
```

**2026-08-17 的實測結果**：

```
膠囊 200          🔴 這個數字就是「核搬過去了沒」——esbuild 那次它是 0
積木規格 209 · 可放置候選 103
畫布上 cpp_break / cpp:break        ← SC-003「說得出是哪一顆」
標籤「跳出迴圈」                     ← i18n 也載進去了（不是 %{BKY_…}）
資源請求失敗 none · Console 錯誤 none
拖曳 101 幀 · 中位 16.6 ms · p95 18.5 ms · 最大 18.7 ms → 順
```

> ⚠️ **這裡的「順」是 Chromium 的，不是 Arduino IDE 的。**
> 混為一談的話，就是 `history/076` 那個錯的形狀（在 A 環境驗、宣稱 B 環境成立）。

---

## 四、🔴 使用者要跑的兩段（SC-002 ／ SC-004）

**這兩條我做不到**——我沒有辦法在 Electron 桌面應用裡拖曳。
所以交付物是一個**自己會報數字的畫面**，讓這一步只需要念數字。

使用者 2026-08-17：「**ArduinoIDE 可以先用 VSCode Extension 測試就可以**」
——所以拆成兩段，**而兩段都要記**。

### 第一段：VSCode（🟢 已經幫你裝好了）

```
已裝在 ~/.vscode/extensions/semorphe.semorphe-vscode-0.1.0
```

**打開 VSCode**（已經開著的話要**完全關掉再開**），然後：

```
1. 左側活動列多一個 <Σ> 圖示（symbol-structure），點它       → SC-002
2. 面板裡有畫布，上面一顆橘色的「跳出迴圈」積木              → SC-003
3. 🔴 拖那顆積木在畫布裡繞一圈，然後看下方讀數的四個數字     → SC-004
```

### 第二段：Arduino IDE（🟢 `.vsix` 也放好了）

```
已放在 ~/.arduinoIDE/plugins/semorphe-vscode.vsix
```

**完全關掉 Arduino IDE 再重開**，然後看同樣的三件事。

⚠️ **第一段過而第二段沒過，那本身就是一個發現**——
`history/080`§五 逐字：「Theia 的 Webview 與 VSCode 的差異**沒有逐項比對過**」。
**兩段的數字都要念，因為它們會決定「宿主獨立性」要驗幾個宿主。**

### 判準（**已經寫在畫面上，不必自己判斷**）

```
中位數 ≤ 20 ms 且 p95 ≤ 33 ms   → 順
中位數 > 33 ms 或 p95 > 100 ms  → 不順
之間                             → 勉強
```

### ⚠️ 一個**已知而沒修**的外觀問題

畫布背景是**白的**，而面板其他部分跟著編輯器主題（深色）。
🔴 **那是 Blockly 的預設，不是壞掉**——主題整合明確排除在本輪之外。
看到白底不用回報，那不是這一刀在問的問題。

### 判準（**已經寫在畫面上，不必自己判斷**）

```
中位數 ≤ 20 ms 且 p95 ≤ 33 ms   → 順
中位數 > 33 ms 或 p95 > 100 ms  → 不順
之間                             → 勉強
```

---

## 五、🔴 而如果它不順——**那不是失敗**

spec SC-007 逐字：

> **而如果畫布跑不動，這一刀【仍然成功】** ——
> 條件是：**如實記下來，並且不換一個更弱的驗收**。

所以請**直接把數字念出來**，不要幫它說好話。

> **一個「不做就繞不過去」的否證，與一個「做到了」的交付，價值一樣。**

⚠️ 而如果是**別的失敗**（面板打不開、畫布空白、破圖），
那不是效能問題，要分開記：

| 症狀 | 大概是什麼 | 要抄下來的 |
|---|---|---|
| 側邊欄沒出現那個容器 | 擴充沒載入 | Arduino IDE 的 Output/開發者工具訊息 |
| 面板開得了但一片空白 | webview.js 被 CSP 擋 | 開發者工具的 CSP 錯誤**原文** |
| 積木在但 `+`／`-` 是破圖 | 🔴 `img-src data:` 漏了 | 同上 |
| 積木在但縮放鈕／垃圾桶是破圖 | 🔴 media URI 錯（多半少一個 `/`） | 同上 |

⚠️ **後兩種都「功能還在」**——所以要**主動看**，它們不會拋錯。
