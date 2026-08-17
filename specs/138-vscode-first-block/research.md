# Research：擴充的第一刀

**Feature**: 138-vscode-first-block　**Date**: 2026-08-17

> 本檔只記**查證過的事實**與由它們導出的決定。
> ⚠️ 凡是「應該可以」都標成未驗，不混進事實區。

---

## 🔴 一、最重要的發現：**核心的檔頭已經寫好答案了，而且是實測的**

`src/core/component/registry.ts:22-48` 逐字：

> 「## 🔴 代價二：**這個架構只跑得起來在 Vite 打包的宿主裡**（2026-08-16 實測）
> `import.meta.glob` 是 **Vite 的轉換**，不是語言特性。實測同一份入口：
> ```
> Vite    → CJS 269 KB → node 跑得動 → 189 顆膠囊全部載入   🟢
> esbuild → CJS 4.6 KB → 🔴 import_meta.glob is not a function
> ```
> ⚠️ **而 4.6 KB 這個數字才是重點**：esbuild **建得出來**，
> 只是 189 顆膠囊**一顆都沒被打包進去**」

而它連處置都寫了（`:43-48`）：

```
A. 那個宿主也改用 Vite 建置    🟢 已實測可行（ssr + lib + formats:['cjs']）
B. 登錄表長出第二種載入方式     ❌ 那會變成第二個真相來源，14 個檔要各寫兩套
→ **A**。而它已經驗過，不是推測。
```

**Decision**：走 A。
**Rationale**：不只是「比較好」，是**已經被實測排除過另一條**。
**Alternatives**：B 已在檔頭被否決，理由是雙重真相來源。

### ⚠️ 而本輪有一個讓它變得更簡單的事實

上面那段講的是**擴充主行程**（Node／CJS）要載膠囊的情形。
🟢 **本輪不需要**：積木畫布住在 **Webview**，而 Webview 是**瀏覽器環境**
——一個普通的 Vite browser build（ESM）就到位，**碰不到 CJS 那個坑**。

```
擴充主行程 extension.js   CJS · node · 'vscode' external · 🟢 本輪不載膠囊
Webview   webview.js      ESM · browser · 🔴 膠囊登錄表住這裡
```

> **那個 4.6 KB 的坑本輪繞得開，不是因為運氣，是因為畫布在瀏覽器那一側。**

⚠️ **但不要因此以為它消失了**：等哪天擴充主行程要跑 lift／generate
（雙向同步那一刀），它會**原封不動地回來**。本輪先記著。

---

## 二、目錄與護欄——⚠️ 而 draft 的數字**低估了**

draft 第四節寫「3 支護欄用 `listSourceFiles('src')`」。**實測 2026-08-17**：

```bash
grep -rln "listSourceFiles('src'" tests/
```
```
tests/helpers/param-reads.ts               （helper，被多條共用）
tests/integration/audit-block-message-args.test.ts
tests/integration/audit-component-id-integrity.test.ts
tests/integration/audit-component-locality.test.ts
tests/integration/audit-dual-truth.test.ts
tests/integration/audit-identity-namespace.test.ts
tests/integration/audit-registry-consumers.test.ts
```

🔴 **是 6 條 ＋ 1 個共用 helper，不是 3 條。**
**那讓「放 `src/vscode/`」這個決定更強，不是更弱。**

### 🔴 而它有一個**立刻影響設計**的後果

`audit-component-locality`（第二十八條）反向也問：
「**資料夾裡的東西都屬於這顆元件嗎**」——外來的身分字串會被報。

```
在 src/vscode/ 裡寫死 'cpp:if' 之類的 conceptId  →  🔴 就近性護欄會叫
```

**Decision**：Webview **不得寫死任何 conceptId**，那顆積木要**從登錄表挑**。
**Rationale**：⚠️ 而這不是「被護欄逼的」——**它正好就是 FR-004 要的東西**。
一顆寫死身分的積木，證明的是「Blockly 能跑」；一顆從登錄表挑出來的，
才證明「核搬得過去」。

> **護欄與規格在這裡指向同一件事，那通常表示判準是對的。**

**挑選規則**（必須是**結構性**的，不能是名字）：

```
候選   registry.getAll() 裡有 blockDef.type 的 spec
挑法   欄位數（args0.length）最少的那一顆 → 「最簡單的一顆」
       同分時取 blockDef.type 字典序最小 → 決定性
```

⚠️ **不可以用「第一顆」**——`registry.ts:26` 逐字警告過：
「登錄順序來自 `import.meta.glob` 的檔名排序，**那不是任何人設計的**」
（`lift-branches.ts:26`）。

---

## 三、重用哪些既有程式碼——⚠️ 而 `App` 一行都不碰

**查證**（`src/languages/cpp/module.ts:71-124`）：`initCppModule()` 建好
registry ＋ 六個引擎，**不需要 DOM、不需要 `App`**。

```
🟢 initCppModule()          languages/cpp/module.ts:71   ← 登錄表的正門
🟢 BlockRegistrar           ui/block-registrar.ts:21     ← 把 spec 變成 Blockly.Blocks
⚠️ App                      ui/app.ts                    ← 🔴 本輪一行都不碰（31 個欄位）
```

`BlockRegistrar.registerBlocksFromSpecs()`（`:272-288`）就是那一段：

```ts
Blockly.Blocks[blockType] = { init: function () { this.jsonInit(blockDef) } }
```

**Decision**：Webview 用 `initCppModule()` ＋ `BlockRegistrar`，**不自己再寫一份**。
**Rationale**：自己寫一份 `jsonInit` 只有 3 行，⚠️ **而那 3 行會是第二個真相來源**
——這個專案付過那個學費（`history/072`：兩條產出路徑，一條綠一條錯）。
**Alternatives considered**：直接讀 `forms/blocks.json`——❌ 那繞過了 `loadFromSplit`
的中性形態排序（`block-spec-registry.ts:71`），而那段有 200 倍代價的病歷。

⚠️ **一個已知的代價**：`BlockRegistrar` 是 2501 行，`registerDynamicBlocks()`
會註冊一大批命令式積木。本輪**照單全收**——它是既有的正路，
而挑三揀四等於在 Webview 裡做一份「哪些要哪些不要」的清單（＝第二個真相）。

---

## 四、Webview 的三個具體障礙（⚠️ 兩個是新的，PoC 沒答）

### ① Blockly 的圖示與音效——**它們不是 `import` 進來的**

`vite.config.ts:23-28` 逐字：Blockly 預設從
`https://blockly-demo.appspot.com/static/media/` 抓 `sprites.png` 與三個 `.mp3`，
而網頁版**把它們複製到 `public/blockly-media/`** 自己託管
（第四十五條護欄 `e2e/offline.spec.ts` 守著「執行期零外部請求」）。

🔴 **在 Webview 裡 `public/` 不存在**，而且外部請求會被 CSP 直接擋掉。

**Decision**：把 media 複製進擴充的產出目錄，由擴充算出 webview URI，
以 `Blockly.inject(div, { media: <uri> })` 傳進去。
**Rationale**：`media` 是 Blockly 的正式選項，不必改任何既有程式碼。
⚠️ **而如果不做，症狀是「破圖但功能還在」——安靜地壞**，
正是 `vite.config.ts` 檔頭記的同一個病。

### ② CSP——而它有一條**不顯然**的

```
script-src  ${webview.cspSource}
style-src   ${webview.cspSource} 'unsafe-inline'   ⚠️ Blockly 會注入 inline style
img-src     ${webview.cspSource} data:             🔴 這一條是新的
media-src   ${webview.cspSource}
```

🔴 **`img-src data:` 為什麼是必要的**：`block-registrar.ts:291-305` 的
`+`／`-` 按鈕是 `'data:image/svg+xml,' + encodeURIComponent(...)`，
**而 `cpp_literal_string` 之外好幾顆動態積木都用它**。
漏掉這一條的症狀又是「按鈕變破圖，功能還在」。

**⚠️ 未驗**：Theia 的 Webview CSP 行為是否與 VSCode 完全一致——**沒有比對過**。
（`history/080`§五 逐字：「Theia 的 Webview 與 VSCode 的差異沒有逐項比對過」）

### ③ `localResourceRoots`

PoC 查得的事實（`history/080`§五）：`localResourceRoots → node_modules/blockly ＋ resources`。
🟢 **本輪更簡單**：Blockly 被 Vite 打包進 `webview.js`，
所以 root 只要指向**擴充自己的產出目錄**一個。

---

## 五、打包成 `.vsix`——而「擴充的宣告住哪」有一刀

`.vsix` 需要一份**擴充的 `package.json`**（`publisher`／`engines.vscode`／
`main`／`contributes`）。而 repo 根目錄那份是**網頁版的**。

| 選項 | 代價 |
|---|---|
| (a) 把擴充欄位加進根 `package.json` | 🔴 汙染網頁版的宣告，而 `vsce` 會打包整個 repo |
| (b) `src/vscode/package.json` | ⚠️ `src` 底下的 `.json` 會被 5 條護欄掃到（`listSourceFiles('src', ['.json'])`） |
| (c) **`src/vscode/manifest.ts` 匯出物件，建置時寫出 `package.json`** | 🟢 是 TypeScript ⟹ 型別檢查得到、護欄看得到、不是散落的 JSON |

**Decision**：(c)。
**Rationale**：宣告是**程式碼的一部分**，而 (c) 讓它受同一套檢查。
⚠️ 而 (b) 的風險不是理論的——`audit-block-message-args` 就掃 `src` 的 `.json`。

**產出佈局**（`build/vscode/` 是產物，進 `.gitignore`）：

```
build/vscode/
  package.json          ← 由 src/vscode/manifest.ts 寫出
  dist/extension.js     ← Vite lib · CJS · 'vscode' external
  dist/webview.js       ← Vite · ESM · browser（膠囊登錄表在這裡）
  dist/webview.css
  media/                ← 從 node_modules/blockly/media 複製
  README.md
```

### 新增的 devDependencies

```
@types/vscode    否則 `npm run build` 的第一步 `tsc` 會紅
@vscode/vsce     打包 .vsix
```

⚠️ **未驗**：`tsconfig` 有 `"types": ["vite/client"]`，而 `@types/vscode` 靠
**模組解析**（`import * as vscode from 'vscode'` → `node_modules/@types/vscode`）
而不是 `types` 陣列。**理論上會通，實作時第一件事就是驗它**——
不通的話就把 `"vscode"` 加進 `types`。

---

## 六、Vite 設定：**一份檔案、兩個目標**

兩個產出的目標完全相反（CJS/node/external vs ESM/browser/bundle-everything），
所以不能一次建完。

**Decision**：一份 `vite.vscode.config.ts`，以 `process.env.SEMORPHE_VSCODE_TARGET`
分岔（`extension` ／ `webview`），`npm run build:vscode` 依序跑兩次再打包。
**Alternatives**：兩份設定檔——⚠️ 兩份會各自漂移，而它們有一半的設定是共用的。

🟢 **網頁版的 `vite.config.ts` 一個字都不動**（FR-006）。

---

## 七、🔴 「畫布順不順」怎麼量——SC-004 要的判準

**Decision**：Webview 自己量，把數字**顯示在頁面上**。

```
量法   Blockly 的 drag 期間用 requestAnimationFrame 記每一幀的間隔
輸出   幀數 N ／ 間隔中位數 ／ 間隔 p95 ／ 最大間隔
判準   中位數 ≤ 20 ms（≥50 fps）且 p95 ≤ 33 ms  → 「順」
       中位數 > 33 ms 或 p95 > 100 ms          → 「不順」
       之間                                     → 「勉強」，如實寫數字
```

**Rationale**：SC-004 逐字要求「判準」而不是結論，而
`history/076` 記過同族的錯（把「跑完了沒拋錯」當成成功）。
**一個顯示在畫面上的數字，讓「看起來還好」不可能被寫進結論。**

### ⚠️ 而這裡有一個我**做不到**的部分，現在講清楚

```
🟢 我做得到   把同一份 webview HTML 在 Chromium 裡跑起來、量到數字
🔴 我做不到   在 Arduino IDE（Electron／Theia）裡拖那顆積木
```

Arduino IDE 是桌面應用，**我沒有辦法驅動它拖曳**。

> **所以 SC-002 與 SC-004 的【Arduino IDE 那一半】必須由使用者跑。**
> 而我交付的是：`.vsix` ＋ 一個**自己會報數字的畫面**，
> 讓那一步只需要「裝上、打開、拖一下、把數字念出來」。

⚠️ **不要把 Chromium 的數字寫成 Arduino IDE 的結論**——
那正是 `history/076` 那個錯的形狀（在 A 環境驗，宣稱 B 環境成立）。

---

## 八、順帶查到的：`vscode-ext/` 是**上一個原型的殘骸**

```
vscode-ext/dist/          ← 未進版控（.gitignore:9-10）
vscode-ext/node_modules/  ← 同上
git ls-files vscode-ext   → 空
```

原始碼在 `3d6768b`（「退休 VSCode 原型」）刪掉了，**而產物留在硬碟上**。

⚠️ **它會讓下一個人以為「已經有基礎」**——`history/069`§四 記的正是這個病：
「一個原型……**它會偽裝成『已經有基礎』**」。

**Decision**：本輪順手刪掉 `vscode-ext/`。
**Rationale**：它零追蹤、零引用，而留著只有誤導價值。
⚠️ 這是**唯一**一個超出 spec 範圍的動作，理由寫在這裡以便反悔。

---

## 未解（本輪不解，記著）

```
❓ Theia 與 VSCode 的 Webview 差異未逐項比對    → 靠 SC-002 的實測回答一部分
❓ 擴充主行程要載膠囊時的 CJS 路徑              → 雙向同步那一刀才會撞到（第一節）
❓ storageService 在 VSCode 裡存哪              → draft 的 4 筆不確定之一，本輪不碰
```
