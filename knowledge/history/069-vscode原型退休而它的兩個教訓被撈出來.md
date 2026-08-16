# 069　VSCode 原型退休——而它的兩個教訓在刪之前被撈出來

> 日期：2026-08-16
> 觸發：討論委派編譯器時，使用者「**幫我看一下 vscode-ext 現況（這是很久以前的，
> 已經很久沒更新了，也沒有對到元件重構，甚至我覺得如果有需要可以重寫）**」
> **恢復方式**：`git show <本 commit>^:vscode-ext/...`，1219 行完整保留在版控裡。

## 轉變

```
old  vscode-ext 是一個原型——「VSCode 那條路已經有基礎」
new  🔴 它的基礎是【負的】：90 個錯誤、零自動化、158 天沒動，
     而其中 19 個錯誤說的是【這個架構載不進非 Vite 宿主】
```

## 一、盤點（實測）

```
最後一次有人動它     2026-03-11（158 天），而同期主專案 src/ 有 369 次提交
自動化              CI／vitest／playwright 【全部沒有提到它】
tsc                 28 個錯——🔴 而全部是 rootDir 那一條
拿掉 rootDir 之後    90 個
```

⚠️ **第一次量的時候我被騙了**：`tsc` 因為一個**設定錯誤**先失敗，
看起來只有設定問題。與 `build-guardrail` 記過的
「**一個在指名之前就拋出的護欄，指不了名**」同一族。

### 90 個錯誤的分類，而最重的不是「過時」

| 類 | 數 | 是什麼 |
|---|---|---|
| 🔴 `TS1343`＋`TS2339` | 19 | **`import.meta.glob` 不存在** |
| `TS2307` | 10 | 階段 6.5 刪掉的檔（`src/blocks/`、`projections/blocks/`） |
| `TS2584`／`TS2304` | 56 | DOM 全域在 extension host 側沒有——**混層** |

## 二、🔴 而那 19 筆是一個架構限制，不是這個原型的問題

見 [開放擴充](../concepts/開放擴充.md)「這個架構今天只去得了 Vite 的宿主」
與 `src/core/component/registry.ts` 檔頭。實測：

```
Vite     CJS 269 KB  → node 跑得動 → 189 顆膠囊全部載入   🟢
esbuild  CJS 4.6 KB  → 🔴 import_meta.glob is not a function
```

> **一個在建置期只發警告、在執行期才炸的相依，
> 會讓「它建得起來」被讀成「它能用」。**

**處置已驗過**：非 Vite 宿主 → **那個宿主也改用 Vite**（`ssr` ＋ `lib` ＋ `formats:['cjs']`）。

## 三、撈出來的兩個教訓——**它們原本只存在於那 8 個檔裡**

### ① 防同步迴圈：同步宿主用布林旗標就夠，非同步宿主要加時間

```
瀏覽器   sync-controller.ts:203   if (this.syncing) return          布林，夠了
VSCode   text-sync.ts:38          setTimeout(() => flag = false, 50) 🔴 要延遲 50ms
```

**因為 `workspace.applyEdit()` 回來之後，`onDidChangeTextDocument` 還沒到。**
布林旗標在 `await` 結束當下就清掉，於是自己寫的內容會被當成使用者的編輯**繞回來**。

> **同一個防迴圈的問題，在同步宿主用布林旗標就夠，在非同步宿主要加時間
> ——而那個時間常數是猜的，沒有人驗過 50ms 夠不夠。**

### ② 🔴 VSCode 整合的真正成本不是 glue code，是「**只有一個文件**」這個假設

`document-session.ts` 的存在本身就是證據：VSCode 有 **N 個文件**，
所以它需要 `Map<uri, {semanticTree, blocklyState, lastSyncSource}>`。

**而瀏覽器把「一個文件」寫進了 app 層的單例**：

```
src/ui/app.ts:69-84   blocklyPanel / monacoPanel / syncController
                      currentTree / currentTopic / enabledBranches
```

**六個單例，每一個在 VSCode 裡都要變成 per-document。**

> **一個「只有一個 X」的假設，不會出現在任何介面上——
> 它出現在【誰持有狀態】上。而那是最貴的一種假設。**

⚠️ 而它與 `階段 0-5b` 的解耦成果不衝突：`SemanticBus`／`ViewHost` 解掉的是
**視圖之間**的耦合，**沒有解掉「有幾個文件」**。

## 四、為什麼是刪掉而不是修

```
它今天防止了什麼退步？   零自動化 → 什麼都沒有
有人在用嗎？             沒有
留著的代價               🔴 讓「VSCode 那條路幾乎免費」讀起來像已經有基礎
```

而 [experience](../experience.md)：「**修一個沒有人在用的東西，改善不會兌現**」。

⚠️ **而重寫的時機不是現在**：委派那條路今天卡在
「clangd 真的吐得出一則診斷」，而**那一步在瀏覽器上驗比在 VSCode 上便宜**。

> **一個原型的用途是回答一個問題。答案過期之後，它剩下的只有維護債
> ——而它會偽裝成「已經有基礎」。**

## 相關

- [concepts/開放擴充](../concepts/開放擴充.md)——Vite 限制的概念落點
- `src/core/component/registry.ts` 檔頭——實測數字與處置
- `specs/018-vscode-extension-prototype/`——原型當初回答的問題（保留）
- [draft/語義診斷系統](../draft/2026-08-05-語義診斷系統.md)——委派的宿主分工，本輪的上游討論
