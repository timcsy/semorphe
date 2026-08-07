---
name: diagnose-in-browser
description: 使用者說 UI「怪怪的」時，用真瀏覽器查根因——先讀 console，再量 DOM，最後做對照實驗。禁止從截圖像素推論。
---

# 用真瀏覽器診斷 UI 問題

## 這個 skill 存在的理由

2026-08-07，使用者回報工具箱「怪怪的」。我**從截圖的像素推了兩輪**：

1. 猜是積木定義壞了 → 查了，是對的
2. 猜是 `updateToolbox()` 沒重排飛出選單 → 寫了修法 → **對照實驗證明無效**

第三輪才去讀 console，而答案**一直在那裡**，逐字寫著：

```
Error: Block "cpp_istringstream_declare": Message does not reference all 2 arg(s).
Error: Block not present in workspace's list of top-most blocks.
  at clearOldBlocks → show → updateFlyout_
```

> **看得到的東西不要用猜的。** 從像素推 UI bug 的錯誤率高到不值得——
> 開瀏覽器是幾分鐘的事，而它給的是**數字與錯誤訊息，不是印象**。

## 順序（不可調換）

### 1. 先讀 console ⚠️ 這一步最常被跳過

```
mcp__claude-in-chrome__read_console_messages  { pattern: ".", limit: 40 }
```

⚠️ **console 追蹤從第一次呼叫這個工具才開始**——載入時的錯誤要**重新整理後**才抓得到。

**在讀完 console 之前，不要提出任何根因假設。** 那兩輪白費就是這樣來的。

### 2. 量 DOM，不看像素

用 `javascript_tool` 取**數字**：位置、數量、`display`、有沒有重複容器。

```js
const bs = [...document.querySelectorAll('<選擇器>')]
const ts = bs.map(b => b.getAttribute('transform'))
({ n: bs.length, 相異座標: new Set(ts).size })
```

**「n 顆但只有 1 個相異座標」＝ 疊在一起**——這是一句可貼給使用者的事實，
而「看起來怪怪的」不是。

⚠️ **同一種容器可能有多個**（實測撞過：兩個 `.blocklyFlyout`，一個是舊的殘留）。
先數容器，再數內容——只查第一個會得到一個看起來正常的答案。

### 3. 做對照實驗才敢說「這是原因」

**把你的改動退掉，用同一支腳本再量一次。**

實測救過一次：我的修法在退掉之後**數字一模一樣**——證明它既沒修好也不是原因。
沒有這一步的話，我會帶著一個無效的修法繼續往下猜。

### 4. 症狀與根因之間可能隔很遠

那次的鏈是：

```
少一個 i18n 鍵 → %{BKY_…} 展不開 → 訊息沒有 %1
  → Blockly jsonInit 拋例外 → clearOldBlocks() 中斷
  → 舊積木永遠清不掉 → 使用者看到一疊重疊的積木
```

**「重疊」與「少一個翻譯鍵」之間沒有任何直覺連結。** 所以：
**照著堆疊追，不要照著症狀猜。**

## 環境的坑（實測踩過）

| 坑 | 處置 |
|---|---|
| 拿到 200 就當成「服務在跑」 | **驗 `<title>`**——5173 上跑的是別的專案 |
| `Blockly.getMainWorkspace` 不存在 | 打包後沒有全域；從 DOM 查，或走真實 pointer 事件 |
| `el.click()` 打不開 Blockly 分類 | 要派發 `pointerdown/mousedown/pointerup/mouseup/click` 全套 |
| 程式化連點太快 | 間隔拉到 ≥2 秒；快點會造出**不存在的**症狀 |
| 改了程式碼但頁面沒更新 | HMR 不重建 class 實例——**重新載入**再量 |

## 做完之後

**把根因變成一條會紅的機械檢查**（走 `build-guardrail`）。
那次的產出是第二十二條護欄「積木訊息必須引用到每一個參數」。

> 一條教訓寫進知識庫，不會讓下一次不發生。**只有機械檢查會。**

## 相關

- [[執行機構]]——為什麼要把它變成護欄
- [[build-guardrail]]——怎麼蓋那條護欄
