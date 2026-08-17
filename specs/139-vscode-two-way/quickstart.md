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

⚠️ **封包會從約 456 KB 長到約 4 MB**——那是 tree-sitter 的 wasm，**預期之內**。

---

## 三、🔴 使用者要跑的（SC 的一半在這裡）

**這些我做不到**——我驅動不了 Electron 桌面應用裡的按鍵與拖曳。
所以面板的讀數會顯示**這次改了幾行／是不是回音／目前哪個節點**，
讓這一步只需要**照著看**。

```bash
# 已經幫你裝好
ls ~/.vscode/extensions/semorphe.semorphe-vscode-*
ls ~/.arduinoIDE/plugins/semorphe-vscode.vsix
```

**完全關掉 VSCode 再開**，開一個 `.cpp` 或 `.ino`（🟢 或直接開一個
未存檔的暫存分頁選 C++——**那是主場景**），按右上角的 `<Σ>`。

### 要看的七件事

| # | 做什麼 | 要看到什麼 | 對應 |
|---|---|---|---|
| 1 | 改一顆積木的欄位 | 讀數顯示「改了 N 行」，⚠️ **第一次會很大、之後應該是 1** | SC-001 |
| 2 | 按一次 Cmd+Z | **只退那一次積木修改**；游標與摺疊沒被重置 | SC-002 |
| 3 | 把積木拖到別處 | 🔴 **檔案沒有變更**（分頁上沒有小圓點） | SC-003 |
| 4 | 貼一段程式進程式碼側 | 積木重畫，**而且停下來**（讀數不會一直跳） | SC-004 |
| 5 | 點一顆積木／移游標 | 另一側跟著亮／被選取 | SC-006 |
| 6 | 按單步幾次 | **積木一顆一顆亮**，程式碼側跟著走 | SC-007 |
| 7 | 切到別的分頁再切回來 | 捲動位置與縮放**還在** | SC-010 |

### ⚠️ 而第 1 條的「第一次會很大」不是缺陷

第一次編輯會把使用者的排版換成我們的（縮排、空行、`enum` 折行）
——🔴 **而今天的行為（整份重寫）本來就是每次都這樣**，所以**沒有變差**。
理由與那個未解的問題寫在 `research.md` 第一節。

**如果第二次之後仍然很大，那才是缺陷**——請回報。

---

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
