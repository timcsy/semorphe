# Phase 0：把「刪比加多」的基準線量出來

> 🔴 SC-003 說「刪掉的行數 > 加上的行數」。那是這一刀的**性質**，
> 而性質要量得到，否則它只是一句話。

## ① 退場清單（量出來的行數）

| 要退場的 | 在哪 | 行數 |
|---|---|---|
| `applyEditorLayout` | `src/vscode/panel.ts` | **127** |
| `arrangeBySplitting`（分割退路） | 同上 | **37** |
| `detectLayoutCaps`（能力探測） | 同上 | **14** |
| `editor-layout.ts` 整支（版面 → 編輯器分組的推導） | `src/vscode/` | **142** |
| 第八十一條的 I4 那一段 | `tests/integration/audit-layout-presets.test.ts` | **9** |

**⟹ 已知會刪掉的：約 329 行**（不含 `layout-presets.ts` 裡的十字與 `state` 特例）。

⚠️ `applyEditorLayout` **不會整支消失**——三張純欄的版面仍然要把每一格
`reveal` 到它那一欄。而它會從 127 行縮成十幾行：**沒有分組樹、沒有退路、
沒有能力探測、沒有「新那一組的號碼要用問的」**。

## ② `state` 與十字散在哪

```
'state' 的特例     layout-presets.ts 4 處 ／ app-shell.ts 3 處
'grid'（十字）      layout-presets.ts 2 處 ／ app-shell.ts 1 處
e2e 提到「十字」    layout-presets.spec.ts 7 處
```

🟢 而 `editor-layout.ts` 裡 `'state'` **零處**——因為它是照 `LAYER_ORDER`
推導的。那支整個退場之後，那份推導的複雜度（`normalizeShape`／2×2 ／
`coversToEnd` 之外的那些）一起走。

## ③ 要加的（估）

```
panel 區的 WebviewView          ~60 行（provider ＋ HTML ＋ 顯示／自動回來）
manifest 的 viewsContainers      ~10 行（曾經有過，2026-09-01 拿掉的）
「有輸出就自己回來」              ~10 行
主控台的開關狀態                 ~15 行（網頁版那側）
新的 I4 護欄                     ~25 行
```

**⟹ 約 120 行。** 而刪的是 329 ＋ 特例。**SC-003 有很大的餘裕**——
⚠️ 而它的意義不是「餘裕大」，是**如果做完之後淨增加，就代表我們把十字的
複雜度搬去了別的地方**。

## ④ 🔴 一個查證過的前提

Arduino IDE（Theia）的 bundle 裡：

```
registerWebviewViewProvider               ✅
resolveWebviewView                        ✅
"views.container.panel"                   ✅ 一個明確的貢獻點
vscode.extension.contributes.view.webview ✅
registerViewContainer(location, spec)     ← panel 是它認得的 location
```

⚠️ 而這次查的是**實作的痕跡**（函式、介面方法、貢獻點 id、它怎麼用那個 id），
不是「那個名字出現過」——上一輪 grep 到 `splitEditorDown` 就寫了退路，
而實測失敗。

> **一個字串出現在 bundle 裡，可能只是鍵盤設定或選單標籤。**

## ⑤ 決定：`state` 從版面宣告裡拿掉，而不是「宣告它是全寬的」

**否決的替代**：在 `areas` 裡讓 `state` 跨滿整列（`[['element','space'],['state','state']]`）。

🔴 它看起來可行，而它保留了整個病：`state` 仍然是**編輯區的一格**，於是
「十字要兩列」那個需求仍然在，Theia 仍然排不了。

> **把一個不該在這裡的東西「排得好看一點」，不會讓它變成該在這裡。**

🟢 正解是**它根本不在 `areas` 裡**——版面只描述編輯區，而主控台是另一個東西。

## ⑥ 風險：最容易弄壞的三件

1. **`effectiveAreas`／`slot-assignment`／`hostLayoutOptions`** 全部吃「有哪幾層」
   ——`state` 抽掉之後那四層變三層，而 2026-09-01 才踩過「一層都不剩就炸」。
2. **槽的選擇器四格 → 三格**（spec 169 的 SC-002：「四個槽的選項完全相同」）
   ——那條 e2e 要跟著改，而**改它要有理由**，不是為了讓它綠。
3. **I4 的空窗**：先讓新護欄紅，再改舊的——否則兩者之間沒有人守。
