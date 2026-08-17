# 080　Arduino IDE 吃 VSCode 擴充——而那不是「多一個平台」，是「搬進學生已經在的地方」

> 日期：2026-08-17　使用者：
> 「**你知道為何我說要做 VSCode 外掛嗎？因為 ArduinoIDE 也可以用！我之前有測試過**」
> 本檔記的是**一個一直只存在於使用者記憶裡的可行性事實**，
> 以及它改變的三件排序。

## 轉變

```
old  VSCode 是「四項獨立性」裡一個抽象的閘門，而它的原型 2026-08-16 才退休
     而「執行」被理解成：不做虛擬硬體 ⟹ 學生沒辦法跑
new  🔴 Arduino IDE 2.x 是 Theia 做的，吃 VSCode 擴充
     ⟹ 燒錄與序列埠【本來就在】，而「透過燒錄執行」不是 workaround，是【真的執行】
```

## 一、而它是**驗證過**的，不是一個樂觀的假設

安裝方式（使用者逐字）：

> 「在當前使用者的使用者目錄找到 `.arduinoIDE`，把剛剛下載好的 `.vsix` 檔
> 複製到裡面的 `plugins` 資料夾中，重開 ArduinoIDE 即可使用。」

**2026-08-17 在本機查證**：

```
~/.arduinoIDE/plugins/           textblockly-0.1.3.vsix   textbricks-0.3.0.vsix
~/.arduinoIDE/deployedPlugins/   兩個都【解開了】  ← Theia 只解開它真的載入的
```

而解開後的宣告：

```
textblockly 0.1.3   engines: vscode ^1.74.0
                    activationEvents: ['onLanguage:arduino']   ← 🟢 IDE 認得 arduino 這個語言 id
                    contributes: commands, menus, languages, configuration
textbricks  0.3.0   activationEvents: ['onStartupFinished']
                    contributes: 🔴 viewsContainers, views, …   ← 🟢 側邊欄視圖容器【支援】
                    main: packages/vscode/dist/extension.js     ← monorepo 佈局
```

> 🔴 **不是「測試過」，是【已經用這條路出貨過兩個擴充】。**

⚠️ **而這件事在此之前不在任何檔案裡** ——
它住在使用者的記憶與一個 home 目錄底下的資料夾裡。
**下一輪的規劃會把它當成未知重新推。**

## 二、它改變的三件事

### ① 第 6 項蒸發一半

vision 的第 6 項是「真板子：`arduino-cli` 上傳 ＋ 序列埠回讀」
——**Arduino IDE 兩個都已經有了**。我們不必做上傳，也不必做序列埠監控。

### ② 🔴 而它翻轉了虛擬硬體的定位

```
原本的理解   虛擬硬體 ＝「執行」的途徑 ⟹ 往後推 ＝ 暫時不能跑
實際         燒錄 ＝ 真的執行，而且【比任何模擬器都準】
             ⟹ 虛擬硬體是【沒有板子的時候】的替代品，不是執行的唯一途徑
```

**那讓「往後推」變成一個更強的決定，不是妥協。**

### ③ 「宿主獨立性」從抽象閘門變成有使用者的東西

`principles.md:160` 逐字，它是**四項獨立性之一**：

> 「**宿主獨立性**：同一套件在瀏覽器和 VSCode 中語義行為完全相同」

四項裡有兩項從來沒被真的驗過——**語言獨立性等 Python，宿主獨立性等 VSCode**。
🟢 **而第二項現在有了時程，而且是一個有使用者的時程。**

## 三、🔴 而有一條既有的分類判斷要重看

`concepts/投影.md` 的資訊分類學把**空行與縮排**列為「呈現／可丟失」。

⚠️ **那個判斷的前提是「程式碼面板是我們的」。**

```
一次性貼回去   排版被重排一次                        ⚪ 可以忍
住在 IDE 裡    每動一顆積木就重寫【他的 .ino 檔】     🔴 每次都掉一次空行
```

> **一個「可以丟失」的分類，前提是那個東西不屬於使用者。**

實測（20 段真實 Arduino 程式）：**內容保真 100%**（註解全在、`enum` 全在、結構全在），
而差異全是排版——縮排 2→4（style 設定）、空行移除、多行 `enum` 折成一行。

## 四、而 `history/069` 的兩個成本**沒有變**

VSCode 原型 2026-08-16 退休時撈出來的兩條，逐字：

> ① 「膠囊登錄表用 `import.meta.glob`（**Vite 的轉換**），所以**那個宿主也必須用
> Vite 建置**（已實測可行）」
> ② 「`src/ui/app.ts` 有**六個單例**寫死了『只有一個文件』，而編輯器有 N 個
> ——**那是這條路真正的成本，而它不在任何介面上**」

🟢 ① 已實測可行。🔴 ② **一個字都沒變**，而 Arduino IDE 也開多個 sketch。

## 五、~~仍然不知道的~~ → 🟢 **PoC 就在旁邊，而三個未知全部有答案**

使用者：「**事實上，你看到的 textblockly 就是我之前測試的 PoC 了**」
——`../TextBlockly/`，**11008 行 TypeScript**，五個版本的 `.vsix`。

```
🟢 Webview 載得動 Blockly     BlocklyViewProvider.ts:54
                              localResourceRoots → node_modules/blockly ＋ resources
🟢 TextDocument 寫得回去      兩條路都寫了：
                              editor.edit(editBuilder)（:577）
                              WorkspaceEdit ＋ workspace.applyEdit（:586）備援
⚪ Open VSX                   不是阻斷——手動丟 .vsix 就會動
```

### 🔴 而它同時示範了三個【已知成本】，一個都沒解掉

**① 整份重寫 ⟹ 使用者的排版每次都被換掉**

```ts
// BlocklyViewProvider.ts:571
const fullRange = new vscode.Range(
  document.positionAt(0),
  document.positionAt(document.getText().length))
editBuilder.replace(fullRange, code)
```

🔴 **那正是第三節預測的失敗樣態，而 PoC 證實了它**：
不是「貼回去一次」，是**每動一顆積木就把他整個檔案換掉**。

**② 防同步迴圈用的是布林旗標**（`CodeSyncManager.ts:5` `isUpdating`）

而 [history/069](069-vscode原型退休而它的兩個教訓被撈出來.md)§三① 逐字：

> 「**同步宿主用布林旗標就夠，非同步宿主要加時間**」

⚠️ **VSCode 的 `applyEdit` 是非同步的。** 而 PoC 用布林 ＋ 四處散落的
`setTimeout`（:72／:283／:535／:560）——**那些 `setTimeout` 就是症狀**。
🟢 **那條教訓因此有了一個具體的實例**，它原本只是一句話。

**③「只有一個文件」的假設 PoC 也有**

`vscode.window.activeTextEditor` 散在 `CodeSyncManager` 與 `BlocklyViewProvider`
——與 `history/069`§三② 記的 `app.ts` 六個單例**是同一個形狀**。

### ⚠️ 而 PoC 自己重寫了一個解析器

`src/ast/ArduinoParser.ts`／`ArduinoTokenizer.ts`／`ArduinoAST.ts`
——**因為它沒有 Semorphe 的核**。

> **合流的形狀因此很清楚：PoC 的【殼】＋ Semorphe 的【核】。**
> 而 PoC 那 11008 行裡，**解析與產生那一半是要丟掉的**。

### 仍然沒驗的

```
❌ Webview 在【Arduino IDE 裡】畫布跑得順不順
   —— `.vsix` 被 deployedPlugins 解開只證明它【載入了】，不證明畫布好用
❌ 而 Theia 的 Webview 與 VSCode 的差異沒有逐項比對過
```

## 六、寫回策略：**整份重寫，照網頁版**（2026-08-17 拍板）

使用者：「**我覺得就照網頁版怎麼處理先試試看，不行再說**」。

**查證**：網頁版**就是整份重寫**——`ui/panels/monaco-panel.ts:352` 的
`this.editor.setValue(code)`，Monaco 的 `setValue` 換掉整份。
**所以「照網頁版」＝ 與 PoC 同一個做法。**

### 而理由比「先試簡單的」樸素，也比它站得住

⚠️ **不是**因為宿主獨立性——那條的原文是「同一套件在瀏覽器和 VSCode 中
**語義行為**完全相同」，而**排版不是語義行為**，那條並不強制。

> **兩邊做同一件事 ⟹ 只有一個行為要推理、一個地方要修。
> 而如果之後要換，兩邊一起換——不會出現「網頁版一種、IDE 一種」的分岔。**

🟢 而分岔正是這個專案付過學費的東西（`history/072`§三：`c-style-parity`
10/10 全綠，**而瀏覽器上仍然產出 `<iostream>`**——兩條產出路徑）。

### 🟢 而退路的地基是活的

```
CodeMapping { nodeId, startLine, endLine }   core/projection/code-generator.ts:12
metadata.sourceRange                          core/types.ts:49
```

⚠️ 而 `monaco-panel.ts:67` 還留著一行病歷：
「**`mappings` 這個欄位在事件上宣告了很久，而零接收者**」
——那是「機制有了沒人接上」的其中一筆，**而它已經被接上了**（`:71`，斷點在用）。

**所以之後換成範圍編輯，是換一個範圍計算，不是蓋一個新機制。**

### 🔴 而使用者接著說：「**如果可以試試範圍編輯也不錯！但是不急**」

**那不是「否決了」，是「想做而排在後面」** ——⚠️ 而這種意圖最容易蒸發。
所以給它一個**觸發條件**，不是「以後再說」：

```
觸發   有人真的在用之後，量一件事：【一次積木編輯平均動到幾行】
       多數是一兩行  → 範圍編輯的收益很大，值得做
       動輒半個檔案  → 範圍編輯自動退化成整份重寫，不急
```

> **範圍編輯不是「永遠只改一點」，是「改多少就寫多少」。**

而粒度有三種，⚠️ **中間那個可能就夠**：

```
① 整份重寫            ← 現在
② 只重寫【改到的那個函式】   🟢 學生改 loop()，setup() 與全域宣告一個字不動
③ 只重寫【改到的那一句】     🔴 結構一變（插一行）行號就位移，要重算
```

**代價已經量過了**：內容保真 100%（註解、`enum`、結構全在），
差異全是排版——見第三節與 [concepts/投影](../concepts/投影.md)「呈現可丟失」旁的標記。

## 相關

- [history/069](069-vscode原型退休而它的兩個教訓被撈出來.md)——原型退休，而它的兩個成本仍然成立
- [history/077](077-虛擬硬體往後推而先做寬度.md)——虛擬硬體往後推，**而本檔讓那個決定更站得住**
- [history/079](079-補量執行之後下一步又換了一次.md)——執行的缺口，⚠️ **而本檔讓「不做執行」變成合理**
- [concepts/投影](../concepts/投影.md)「資訊分類學」——🔴 第三節說的那條要重看
- [principles](../principles.md)「四項獨立性」——宿主獨立性
- `../TextBlockly/`——PoC 本體（⚠️ 不在這個 repo 裡，而它是第五節每一條的出處）
