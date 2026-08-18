# Quickstart：怎麼驗這一刀

**Feature**: 139-vscode-two-way　**Date**: 2026-08-17

---

## 前置

```bash
cd /Users/timcsy/Documents/Projects/semorphe
npm install          # 本輪零新增外部相依
```

---

## 一、我驗得到的（自動）

```bash
# ① 四塊純函式——本輪的核心邏輯
npx vitest run tests/integration/vscode-rewrite-span.test.ts \
               tests/integration/vscode-echo-guard.test.ts \
               tests/integration/vscode-settings.test.ts \
               tests/integration/vscode-view-state.test.ts

# ② 🔴 範圍計算升格之後，探針的數字【不得改變】
npx vitest run tests/probes/edit-blast-radius.test.ts
#    期望：欄位編輯中位 1 行、≤1 行 99.5%、跨距>半檔 0 筆

# ③ 全套回歸
npm test

# ④ 中立性
npx vitest run tests/integration/audit-neutrality.test.ts

# ⑤ 探針不得退步
npx vitest run tests/probes/arduino-realistic.test.ts
#    期望：殘差 0.07%、漂移 0/20

# ⑥ 型別（含新程式碼，🔴 不得靠 exclude 過關）
npx tsc --noEmit
```

**⚠️ 而有兩條要用眼睛看，因為它們是「不會報錯的壞」**：

```bash
# 護欄基線有沒有被偷偷改
git diff --stat -- 'tests/**/baselines/*'      # 🔴 期望：空的

# CSP 只多了一項
git diff -- src/vscode/webview-html.ts | grep -E '^\+.*src'
#    🔴 期望：只有 'wasm-unsafe-eval'，不得出現 'unsafe-eval' 或 default-src 放寬
```

---

## 二、打包與 Chromium 預檢

```bash
npm run build:vscode
node tools/vscode-preflight/run.mjs --shot /tmp/preflight.png
```

**期望**（在第一刀的基礎上多出來的）：

```
膠囊 ≥ 200                     （第一刀已有）
🆕 工具箱分類數 = 網頁版的分類數
🆕 畫布是深色、zelos renderer
🆕 tree-sitter 載得起來        （console 錯誤仍然是 0）
```

⚠️ **封包會從約 470 KB 長到約 1.04 MB**——那是 tree-sitter 的 wasm。
🟢 而它比 plan 預估的「約 4 MB」小得多：wasm 在 vsix 的 zip 裡壓得很好。

---

## 三、🔴 使用者要跑的（SC 的一半在這裡）

**這些我做不到**——我驅動不了 Electron 桌面應用裡的按鍵與拖曳。
所以面板下方的**讀數**會顯示這些欄位，讓這一步只需要**照著看**：

```
膠囊 / 工具箱分類 / 目標        地基有沒有載起來
文件                            接到哪一份、第幾版
第幾次編輯                      積木改了幾次
上次編輯改了幾行                🔴 SC-001 就看它
無變更的積木事件                🔴 FR-003 就看它（拖位置這格會加，上一格不會動）
目前選取 / 指不到程式碼的選取    SC-006
執行步數                        SC-007
程式碼→積木                     lift 有沒有就緒（🔴 壞了不會拋錯）
```

### 安裝（已經幫你裝好了）

```bash
ls -d ~/.vscode/extensions/semorphe.semorphe-vscode-*
ls ~/.arduinoIDE/plugins/semorphe-vscode.vsix
```

🔴 **完全關掉 VSCode 再開**（`Cmd+Q`，不是 Reload Window）。
開一個 `.cpp`／`.ino`，**或直接開一個未存檔的暫存分頁選 C++**
——⚠️ **那是主場景**（「AI 給的 Code 貼上來」）。
右上角按 `<Σ>`，或 Command Palette → `Semorphe: 開啟積木面板`。

### 要看的七件事

| # | 做什麼 | 要看到什麼 | 對應 |
|---|---|---|---|
| 1 | 改一顆積木的欄位 | 讀數「上次編輯改了幾行」是**小數字**（1～2） | SC-001 |
| 2 | 按一次 `Cmd+Z` | **只退那一次積木修改**；游標與摺疊沒被重置 | SC-002 |
| 3 | 把積木拖到別處 | 🔴 **分頁上沒有未存檔的小圓點**；讀數只有「無變更的積木事件」在加 | SC-003 |
| 4 | 貼一段程式進程式碼側 | 積木重畫，**而且停下來**（讀數不會一直跳） | SC-004 |
| 5 | 點一顆積木／移游標 | 另一側跟著亮／被選取 | SC-006 |
| 6 | 按面板下方的「▶\| 單步」幾次 | **積木一顆一顆亮**，程式碼側跟著走，狀態顯示「暫停（第 N 步）」 | SC-007 |
| 7 | 切到別的分頁再切回來 | 捲動位置與縮放**還在** | SC-010 |

### 順便試一下設定（SC-008）

在專案的 `.vscode/settings.json` 裡：

```jsonc
{
  "semorphe.target": "cpp",
  "[arduino]": { "semorphe.target": "arduino" }
}
```

**存檔之後面板要自己更新**（不用重開）——⚠️ 而開 `.ino` 時工具箱應該換成 Arduino 那組。

### ⚠️ 一件事我要先說在前面

規劃時我曾解釋「第一次編輯會重排使用者的排版，所以跨距會很大」。
🔴 **那個解釋後來被證明是錯的**（真正的原因是一個漏掉的註冊，已修）。
所以現在**第一次編輯就該是小數字**。

**如果第 1 條看到一個很大的數字，那是缺陷，請回報。**

## 四、遇到問題時要抄下來的

| 症狀 | 大概是什麼 | 抄什麼 |
|---|---|---|
| 面板空白 | Webview 沒起來 | 開發者工具的 **CSP 錯誤原文** |
| 積木出來但工具箱沒有 | 工具箱建置失敗 | console 的錯誤 |
| 貼程式後積木沒變 | tree-sitter 沒載起來 | console 有沒有 `CompileError` |
| 積木一直閃／讀數一直跳 | 🔴 **防迴圈壞了** | 讀數上「是不是回音」那一欄 |
| 改一顆積木整個檔案都變 | 範圍算錯 | 讀數的「改了 N 行」＋ 是第幾次編輯 |
| 按 Cmd+Z 退太多 | undo 分組錯了 | 做了什麼、退掉了什麼 |

⚠️ **前兩種會拋錯，後四種不會**——所以後四種要**主動看讀數**。
