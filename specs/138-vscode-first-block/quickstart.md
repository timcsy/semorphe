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
npx vite build --config vite.vscode.config.ts   # SEMORPHE_VSCODE_TARGET=webview
npx vite preview --outDir build/vscode/dist     # 或既有的 e2e 路徑
```

畫面上的讀數要顯示：

```
膠囊 ≥ 200          🔴 這個數字就是「核搬過去了沒」
spec 數  > 0
畫布上：<blockType> / <conceptId>     ← SC-003「說得出是哪一顆」
```

然後**拖一下那顆積木**，讀數會補上：

```
frames / median / p95 / max / verdict
```

> ⚠️ **這裡的 verdict 是 Chromium 的，不是 Arduino IDE 的。**
> 混為一談的話，就是 `history/076` 那個錯的形狀（在 A 環境驗、宣稱 B 環境成立）。

---

## 四、🔴 使用者要跑的兩步（SC-002 ／ SC-004）

**這兩條我做不到**——我沒有辦法在 Electron 桌面應用裡拖曳。
所以交付物是一個**自己會報數字的畫面**，讓這一步只需要念數字。

```bash
cp build/vscode/*.vsix ~/.arduinoIDE/plugins/
# 然後【完全關掉】Arduino IDE 再重開
```

### 要看的三件事

```
1. 側邊欄多了一個容器，點得開                    → SC-002
2. 面板裡有畫布，畫布上有一顆積木                 → SC-003
   （讀數上會寫它的 conceptId）
3. 拖那顆積木橫跨畫布、縮放兩次 → 念讀數上的數字   → SC-004
```

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
