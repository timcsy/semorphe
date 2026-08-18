# Quickstart：怎麼驗這一刀

**Feature**: 140-app-in-host　**Date**: 2026-08-18

---

## 一、🔴 最重要的一條：**網頁版還一樣嗎**

這一刀動的是網頁版的核心，而 `history/072` 的病歷是
「一條路徑全綠，**而另一條安靜地錯了**」。

```bash
npm test                                     # 全綠
git status --porcelain -- 'tests/**/baselines/*'   # 🔴 期望：空的
npx vitest run tests/integration/audit-neutrality.test.ts    # total = 0
npx vitest run tests/probes/arduino-realistic.test.ts        # 0.07% / 0 漂移
npx tsc --noEmit
```

⚠️ **而還有一條不能省，它是這個專案的明文教訓**：

```bash
npm run dev     # 🔴 開瀏覽器看一眼
```

> **測試綠不代表使用者看到的是對的。**

要看的：工具列的每個選擇器、積木畫布、程式碼面板、下方分頁、狀態列
——**與改動前一模一樣**。

---

## 二、三支新測試

```bash
npx vitest run tests/integration/host-no-overwrite.test.ts       # 🔴 開機不覆蓋檔案
npx vitest run tests/integration/host-code-view-contract.test.ts # 缺席要有理由
npx vitest run tests/integration/host-profile-no-branch.test.ts  # 不得用 id 分支
```

---

## 三、擴充側

```bash
npm run build:vscode
node tools/vscode-preflight/run.mjs --shot /tmp/p.png
```

**期望**（與 spec 139 的差別）：

```
🆕 工具列       目標／課程／風格／語言選擇器都在
🆕 除錯工具列   執行／單步／停止
🆕 下方分頁     主控台／變數
🆕 狀態列
🔴 而【沒有】程式碼編輯區——它在 IDE 的編輯器裡
🔴 也【沒有】spec 139 那排診斷數字（搬進宿主的輸出頻道了）
console 錯誤 0 · 資源請求失敗 0
```

---

## 四、🔴 使用者要跑的（SC-001 與 SC-003 在這裡）

**這兩條我做不到**：一條是「看起來像不像」（人的判斷），
一條是「每個控制項按下去都有作用」（要在 IDE 裡逐一按）。

```bash
ls -d ~/.vscode/extensions/semorphe.semorphe-vscode-*
```

`Cmd+Q` 完全關掉 VSCode 再開 → 開一個 `.cpp`／`.ino`（或未存檔的暫存分頁）
→ 右上角 `<Σ>`。

### 要看的四件事

| # | 做什麼 | 要看到什麼 | 對應 |
|---|---|---|---|
| 1 | 🔴 **把網頁版與擴充並排** | **看得出是同一個產品** | SC-001 |
| 2 | 逐一按工具列上的每個控制項 | **可用的都有作用；不該有的一個都不在** | SC-003 |
| 3 | 打開一個**有內容**的檔案 | 🔴 **內容一個字元都沒變** | SC-004 |
| 4 | 上一輪那七件事再跑一次 | 全部還在 | SC-005 |

⚠️ **第 1 條我會附並排截圖** —— 而**判斷是你的**，不是我描述它有多像。

> **一個「像不像」的驗收，換成「有幾個區塊」就不再是同一條驗收了。**

### 🔴 而第 3 條是唯一一條「做錯了會毀損你的檔案」的

如果打開面板之後檔案內容變了（多了、少了、被換掉），
**立刻回報並且不要存檔** —— 那是 FR-004 失效。

---

## 五、遇到問題時要抄下來的

| 症狀 | 大概是什麼 | 抄什麼 |
|---|---|---|
| 面板一片空白 | 應用啟動失敗 | 開發者工具的**錯誤原文** |
| 工具列在但選擇器沒作用 | 注入的宣告漏了 | 按了哪一個、有沒有反應 |
| 出現開檔／存檔按鈕 | 🔴 `features` 沒關掉（FR-006） | 截圖 |
| 打開檔案後內容變了 | 🔴 **FR-004 失效** | **立刻回報，不要存檔** |
| 網頁版跟著變了 | 抽介面時改到行為 | 哪裡不一樣 |
