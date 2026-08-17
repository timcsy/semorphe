# Contract：宿主 ↔ Webview

**Feature**: 138-vscode-first-block　**Date**: 2026-08-17

> 本輪的介面小得反常，⚠️ **而那是設計，不是省略**。

---

## 🔴 一、訊息協定：**空的**

```
extension → webview   （無）
webview → extension   （無）
```

**為什麼**：本輪不寫回、不讀檔、不存檔。任何一條訊息都會把
`history/080`§五② 那個坑拉進來——

> 「**同步宿主用布林旗標就夠，非同步宿主要加時間**」
> 而 PoC 的 `isUpdating` 布林 ＋ 四處 `setTimeout` 就是症狀。

**一個空的協定不需要防迴圈。** 下一刀才付那個代價。

---

## 二、宿主注入給 Webview 的東西——**只有一樣**

Webview 的 HTML 由 `panel.ts` 產生，而它要注入 **Blockly 的 media 根**：

```
window.__SEMORPHE_BLOCKLY_MEDIA__ : string
```

它是 `webview.asWebviewUri(<擴充產出目錄>/media/)` 的結果，
交給 `Blockly.inject(div, { media: window.__SEMORPHE_BLOCKLY_MEDIA__ })`。

🔴 **不注入的話**：Blockly 會去 `https://blockly-demo.appspot.com/static/media/` 抓
（`vite.config.ts:23` 記著），而 CSP 會擋掉 —— 症狀是**破圖但功能還在**。

⚠️ **這條契約有一個尾端斜線的陷阱**：Blockly 直接把 `media` 當前綴接檔名，
少一個 `/` 就變成 `.../mediasprites.png`。**組 URI 時要顯式補**。

---

## 三、CSP——**四條，而第三條不顯然**

```
default-src 'none'
script-src  ${webview.cspSource}
style-src   ${webview.cspSource} 'unsafe-inline'    ⚠️ Blockly 注入 inline style
img-src     ${webview.cspSource} data:              🔴 見下
media-src   ${webview.cspSource}
```

### 🔴 `img-src` 為什麼一定要 `data:`

`src/ui/block-registrar.ts:291-305`：`+`／`-` 按鈕是

```ts
'data:image/svg+xml,' + encodeURIComponent('<svg …>')
```

而**好幾顆動態積木都用它**（`cpp_var_declare`、`cpp_print`、
`cpp_array_declare`、`cpp_vector_declare`、`cpp_initializer_list`…）。

⚠️ 漏掉這一條的症狀又是**「按鈕變破圖，功能還在」**——
與 media 那條同一個病。

> **這一刀有兩個獨立的失敗方式都長成「破圖但功能還在」。
> 兩個都必須被主動檢查，因為它們不會拋錯。**

### 🟢 而 `localResourceRoots` 本輪只要一個

Blockly 被 Vite 打包進 `webview.js`，所以只需指向**擴充自己的產出目錄**。
（PoC 需要指 `node_modules/blockly` 是因為它沒有打包。）

---

## 四、`contributes`（`manifest.ts` 的宣告）

```
viewsContainers.activitybar   一個容器
views.<容器 id>                一個 webview 型別的視圖
engines.vscode                 ^1.74.0   🟢 已證實在 Arduino IDE 裡可用
activationEvents               onStartupFinished
                               🟢 textbricks 用的就是這個，而它在 IDE 裡載得起來
```

⚠️ **不要用 `onLanguage:arduino`**：那要開了 `.ino` 才啟動，
而本輪要驗的是「面板打不打得開」，**啟動條件愈少變因愈少**。
（`textblockly` 用 `onLanguage:arduino`，`textbricks` 用 `onStartupFinished`
——`history/080`§一 兩個都記了。**本輪照後者。**）

---

## 五、`pickSimplestBlock` 的契約（**唯一可單元測的介面**）

```
輸入   BlockSpec[]（登錄表的全部）
輸出   BlockSpec —— 要畫在畫布上的那一顆

規則   1. 只考慮【中性形態】（未宣告 form）
       2. 只考慮有 blockDef.type 的
       3. 🔴 只考慮【能站在空白畫布上】的（有 previousStatement 或 nextStatement）
       4. 取 blockDef.args0 長度最小者
       5. 同分時取 blockDef.type 字典序最小 —— 決定性

保證   🔴 對輸入順序【不敏感】：打亂輸入，輸出不變
       🔴 輸入為空時【拋錯】，不回 undefined
```

⚠️ **規則 5 與「保證」是同一件事的兩面，而它有病歷**：

> `lift-branches.ts:26` 逐字：
> 「登錄順序來自 `import.meta.glob` 的檔名排序，**那不是任何人設計的**」

**一個依賴載入順序的挑選，會在有人新增一顆膠囊的那天安靜地換一顆積木。**

⚠️ **規則 3 的理由**：expression 形態 `setOutput` 而沒有
`previousStatement`——它在空白畫布上**接不到任何東西**，
放上去會讓人以為積木壞了。

🔴 **而這個函式裡不得出現任何 conceptId 字串**——
判準全部是結構性的。那既是 FR-004 要的，也是第二十八條護欄在看的。
