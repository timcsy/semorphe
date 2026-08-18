# Data Model：擴充的第一刀

**Feature**: 138-vscode-first-block　**Date**: 2026-08-17

---

## 🔴 先說結論：**本輪沒有新的資料模型**

```
沒有持久化      storageService 的 per-uri 化【明確排除】
沒有新實體      積木的資料模型是既有的 BlockSpec，一個欄位都不加
沒有寫回        不讀 .ino、不寫 TextDocument
```

> **一刀如果沒有新的資料，那它證明的就是「既有的資料到得了新的地方」。**
> ——而那正是 FR-004。

⚠️ 所以本檔記的是**既有實體在新宿主裡的流向**，不是新設計。

---

## 一、既有實體（一個欄位都不改）

### `BlockSpec`（`src/core/types.ts`，由 `BlockSpecRegistry` 持有）

本輪只讀這幾格：

| 欄位 | 本輪的用途 |
|---|---|
| `blockDef.type` | 交給 `Blockly.Blocks[type]`；同分時的決定性排序鍵 |
| `blockDef.args0` | 🔴 **挑積木的判準**——長度最小者勝 |
| `conceptMapping.conceptId` | 顯示在讀數上（SC-003「說得出是哪一顆」） |
| `form` | 🔴 **只取中性形態**（`form` 未宣告者）——變體不參與挑選 |

⚠️ **為什麼要排除變體**：`block-spec-registry.ts:76-85` 記著
「一個元件身分可以有多個形態」，而一顆 expression 變體
`setOutput` 而沒有 `previousStatement`——它在空白畫布上**接不到任何東西**，
放上去只會讓人以為積木壞了。

### `ComponentRegistration`（`src/core/component/registry.ts`）

只用來**數數**：讀數要顯示「載入了幾顆膠囊」。
🔴 **那個數字就是「核搬過去了沒」的證據**——esbuild 那次它是 0
（`registry.ts:31`：「189 顆膠囊**一顆都沒被打包進去**」）。

---

## 二、本輪新增的**唯一**資料形狀：畫面上的讀數

它不進任何儲存，只是一段顯示在 Webview 上的文字。

```
CanvasReadout
  capsules      number     載入的膠囊數        期望 ≥ 200
  specs         number     登錄表裡的 spec 數
  blockType     string     畫布上那顆的 blockDef.type
  conceptId     string     🔴 它的概念身分（SC-003）
  frames        number     最近一次拖曳量到幾幀
  medianMs      number     幀間隔中位數        判準 ≤ 20
  p95Ms         number     幀間隔 p95          判準 ≤ 33
  maxMs         number     最大間隔
  verdict       '順' | '勉強' | '不順'
```

⚠️ **`verdict` 由數字算出，不由人填** —— 判準寫在 research 第七節。

> **一個由數字算出來的結論，讓「看起來還好」寫不進去。**

---

## 三、狀態轉移——**只有一條，而且是單向的**

```
擴充啟動 → 建 Webview → 載 webview.js
   → initCppModule()（膠囊登錄表 → BlockSpec[]）
   → pickSimplestBlock(specs) → 一顆 spec
   → BlockRegistrar 註冊 → Blockly.inject → 放一顆積木
   → 使用者拖曳 → fps 量測 → 更新讀數
```

🔴 **沒有反向的箭頭。** 沒有訊息回傳給擴充、沒有寫回檔案、沒有存檔。
⚠️ 而那是**刻意的**：多一條反向箭頭就會撞上
`history/080`§五② 記的「非同步宿主用布林旗標防迴圈」那個坑，
**而本輪不需要付那個代價**。

---

## 四、⚠️ 而有一個「以後會回來」的資料問題，現在只記著

```
storageService   key 是固定的 'semorphe-state'（core/storage.ts:4）
                 → 在 VSCode 裡它要變成 per-uri，而【存哪裡】也要換
```

本輪不碰，因為本輪不存東西。
**但下一刀（雙向同步）第一件撞到的就是它。**
出處：`draft/2026-08-17-擴充的形狀.md` 第二節那 4 筆不確定。
