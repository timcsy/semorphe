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

## 五、仍然不知道的

```
Theia 的 API 子集到哪裡     🟡 `views`／`viewsContainers` 已證實可用，
                            而【Webview 跑不跑得動 Blockly 畫布】沒驗過
TextDocument 編輯行為        ❌ 沒驗——而它正是雙向轉換的另一半
Open VSX                    ⚪ 不是阻斷——手動丟 .vsix 就會動
```

## 相關

- [history/069](069-vscode原型退休而它的兩個教訓被撈出來.md)——原型退休，而它的兩個成本仍然成立
- [history/077](077-虛擬硬體往後推而先做寬度.md)——虛擬硬體往後推，**而本檔讓那個決定更站得住**
- [history/079](079-補量執行之後下一步又換了一次.md)——執行的缺口，⚠️ **而本檔讓「不做執行」變成合理**
- [concepts/投影](../concepts/投影.md)「資訊分類學」——🔴 第三節說的那條要重看
- [principles](../principles.md)「四項獨立性」——宿主獨立性
