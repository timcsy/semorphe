# Phase 0：查證

⚠️ 底下每一條都是**對著程式碼查的**，不是照抄 vision。行號是 2026-09-06 的。

## 一、事件那一半已經完整

`src/core/sync-controller.ts:696` `scaffoldNotice(tree)` 回傳
`{ nodeIds, mode }`，而**四個發送點全部帶著它**（474 / 541 / 593 / 768）。
那支函式的檔頭自己寫著理由：

> 「⚠️ 四個發送點各自組一份的話，遲早有一個會漏掉
> ——而漏掉的那一條路上，視圖會以為『這支程式沒有骨架』。」

🟢 **所以真相那一側一行都不用改**（除了下面第三條那個新增的發布點）。

## 二、流程視圖已經在讀，而它的形狀就是我們要的

`src/ui/panels/flow-panel.ts:968`：

```ts
if (event.scaffold) {
  this.scaffoldIds = new Set(event.scaffold.nodeIds)
  this.scaffoldMode = event.scaffold.mode
}
```

⚠️ 而它上面一行是 `this.tree = structuredClone(event.tree)`
——**`tree` 是必要欄位**。任何新的發布點都得帶著樹。

## 三、🔴 真正的難點：深度變了而樹沒變

`setScaffoldDepth` 在 `app.ts` 有 **6 個呼叫點**（745 / 875 / 1099 / 1347 / 2153 / 3462），
而它們**都不發事件**——外觀靠另一條路更新：

```
app.ts:1990  markOutOfScopeBlocks()   ← 它【同時】做兩件事
               ├─ blocklyPanel.markOutOfScopeBlocks(getVisibleComponents())
               └─ remarkScaffold()  →  blocklyPanel.markScaffoldBlocks(ids, mode)   🔴
```

而 `markOutOfScopeBlocks()` 自己有 **6 個呼叫點**，其中 4 個包在
`setTimeout(…, 900)` 裡。

⚠️ **那個 900 毫秒不是隨便寫的**——`app.ts:757` 記著它踩過的雷：

> 「…是在**換目標的途中**跑的——那時『這個主題看得到哪些元件』還沒算完，
> 於是整個畫布被判成超出範圍，**每一顆積木都變淡**」

### 決定：由真相那一側補發一次

- **Decision**：`SyncController` 多一支「重發骨架告示」，
  它發一則 `semantic:update`，帶 `tree` ＋ `code` ＋ `scaffold`，
  **而不帶 `blockState`**。
- **Rationale**：積木面板的重畫本來就**閘在 `event.blockState` 上**
  （`blockly-panel.ts:214` `if (!mine && event.blockState)`）
  ——不帶它，那則事件就只會做「套用骨架告示」這一件事，
  **而重畫、復原堆疊、拖曳中斷全部不會發生**。
  🟢 流程面板收到會 `rebuild()` 一次，那是它本來每次更新都做的事。
- **Alternatives considered**：
  - ❌ **積木面板多開一個入口**（`applyScaffold(ids, mode)` 給組裝點叫）
    ——那是把今天這條債換一個名字留下來。
  - ❌ **讓 `setScaffoldDepth` 自己發**——它在 `SyncController` 上，
    而 6 個呼叫點裡有些是「先設好，等一下才要用」（例如換目標的途中）。
    自己發的話會回到那個 900 毫秒的雷。**發不發由組裝點決定，發什麼由真相決定。**
  - ❌ **帶 `blockState` 一起發**——那會重畫，而重畫會打斷拖曳
    （`blockly-panel.ts:212` 整段就是在處理這件事）。

## 四、⚠️ 已知的雷：標記會動拖曳策略

`app.ts:1757` 逐字：

> 「根因：`markScaffoldBlocks` 會 `setDragStrategy` ＋ `setEditable(false)`」

而它下面接著記了一筆墓碑：這裡曾經**立刻**再蓋一次，而 e2e 抓到代價。

🔴 **所以這一刀不能只驗外觀，要驗拖曳**——spec 的 US2 就是為此。

## 五、護欄怎麼寫

- **Decision**：掃 `src/`，`.markScaffoldBlocks(` 出現在 `blockly-panel.ts`
  **以外**的檔案 → 紅。
- **Rationale**：`private` 只擋 TypeScript，擋不住有人把它改回 `public`
  ——而這條債今天就是那樣長出來的。
  判準同 `concepts/執行機構.md`：**一個沒有機械檢查的規範，會被下一次順手還原**。
- **注入測試**：合成一份「組裝點裡有那一行」的輸入 → 必須報得出檔名與行號。
