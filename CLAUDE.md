# Semorphe Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-02

## Active Technologies
- localStorage（瀏覽器本地） (002-concept-blocks-redesign)
- TypeScript 5.x + Blockly 12.4.1, web-tree-sitter 0.26.6, CodeMirror 6.0.2 (003-polish-block-ux)
- TypeScript 5.x + Blockly 12.4.1, web-tree-sitter 0.26.6, CodeMirror 6.0.2, Vite (006-arch-four-dimensions)
- localStorage（瀏覽器） (006-arch-four-dimensions)
- TypeScript 5.x + Blockly 12.x, Monaco Editor (最新穩定版), web-tree-sitter 0.26.x, Vite 7.x (008-semantic-tree-restructure)
- localStorage（自動儲存）+ JSON 檔案匯出匯入 (008-semantic-tree-restructure)
- TypeScript 5.x + Blockly 12.4.1, Monaco Editor, web-tree-sitter 0.26.6, Vite (009-restore-legacy-features)
- TypeScript 5.x + Blockly 12.4.1, web-tree-sitter 0.26.6, Vite (011-unified-pattern-engine)
- N/A（Registry 為記憶體中的 Map） (011-unified-pattern-engine)
- TypeScript 5.x + Blockly 12.4.1, web-tree-sitter 0.26.6, Monaco Editor 0.52.2, Vite 7.3.1 (012-first-principles-compliance)
- localStorage（瀏覽器自動儲存） (012-first-principles-compliance)
- localStorage (browser) (013-ux-first-principles)
- TypeScript 5.x + 無新增外部依賴（純 TypeScript 型別 + EventEmitter 實作） (014-decoupling-infra)
- N/A（記憶體中） (014-decoupling-infra)
- TypeScript 5.x + 無新增（使用 Phase 0 建立的 SemanticBus + ViewHost） (015-sync-decouple)
- TypeScript 5.x + Blockly 12.4.1, web-tree-sitter 0.26.6, Monaco Editor, Vite (016-app-split)
- TypeScript 5.x + Blockly 12.4.1, web-tree-sitter 0.26.6, Monaco Editor, Vite 7.x (017-concept-blockdef-split)
- localStorage（瀏覽器自動儲存）+ JSON 檔案匯出匯入 (017-concept-blockdef-split)
- TypeScript 5.x + Blockly 12.4.1, web-tree-sitter 0.26.6, Vite + Blockly, web-tree-sitter, Monaco Editor (VSCode) (019-cpp-std-modules)
- N/A（記憶體中的 Registry） (019-cpp-std-modules)
- TypeScript 5.x + Blockly 12.4.1, web-tree-sitter 0.26.6, Vite + Blockly（積木渲染）, tree-sitter-cpp（AST 解析）, Vitest（測試） (047-pointer-ref-ux)
- TypeScript 5.x + Blockly 12.4.1 + Blockly（積木渲染/序列化）, Vitest（測試） (048-unify-extractor)

- TypeScript 5.x + Blockly 12.x, web-tree-sitter 0.26.x, CodeMirror 6.x (001-code-blockly-converter)

## Project Structure

```text
src/
tests/
```

## Commands

### 什麼時候跑什麼（2026-08-21 量測之後定的）

全套 412 個檔約需兩分鐘，而**成本是 per-file 的模組載入**——每個測試檔各自
載入一次 Blockly ＋ tree-sitter wasm ＋ 177 顆膠囊的 glob。所以：

| 你在做什麼 | 跑什麼 | 量級 |
|---|---|---|
| 改一顆元件、改一段邏輯 | `npx vitest run <那個檔或目錄>` | **秒** |
| 改核心／投影／解譯器 | `npm run test:unit` ＋ `npm run test:capsule` | 十幾秒 |
| 🔴 **改宣告、身分、基線、工具箱、課程清單** | `npm run test:guard`（54 條護欄） | 分鐘 |
| 🔴 **改了「使用者按得到的東西」**（按鈕、選單、面板結構） | **`npm run test:e2e`** | 十分鐘 |
| 🔴 **改了「一段程式碼會被 lift 成哪些元件」** | **`npm run test:e2e`** | 十分鐘 |
| 🔴 **改了「輸出的文字表示」**（`nan`／`inf`／數字格式／跳脫字元） | **`npm run test:e2e`** | 十分鐘 |
| 🔴 **改了積木的畫法**（膠囊定義、`block-registrar`、renderer） | **重產課文的對照圖**（見下） | 六分鐘 |
| 🔴 **改 lift／產生器**（`lifters/strategies.ts`、`code-generator.ts`、膠囊的 `lift`／`generate`） | **拿真實語料重量一次**（見下） | 十秒 |
| 🔴 **改宣告的 lift／渲染／抽取** | **四個面向全掃**（見下，要參照編譯器） | 兩分鐘 |
| commit 前 | `npm test`（全套） | 四分鐘 |
| 🔴 **push 之後** | **`gh run list --limit 3`** | 十秒 |
| PR | CI 跑全套 ＋ `npm run test:e2e` | — |

🔴 **「push 之後看 CI」那一列是 2026-09-18 加的，而它是使用者發現的**：
CI 從第 182 刀起紅，**連續四次合併**，而每一次我都跑了全套（7000+ 綠）、
每一次都沒有看 CI。使用者只說了三個字：「CI失敗」。

> **一條「本機全綠就等於好了」的習慣，量到的是本機那台機器的寬鬆程度。**

⚠️ 而那四次紅的**原因是同一個**，下一節說。

🔴 **全套的並行度壓在 2**（2026-09-17 量的，兩次被系統砍掉之後）——
**已經寫進 `vitest.config.ts`，不必記得加旗標**。
⚠️ 而要知道它的症狀：不壓的話**不是變慢，是被砍掉**，畫面看起來像「卡住了」
（輸出停在半路、零支紅、沒有錯誤訊息）。理由與量測見那個檔的 `maxWorkers` 註解。

🔴 **而「看起來像卡住了」有第二個原因，它不是記憶體**（2026-09-20 量到的）。
全套四次被砍，我歸因成「這台機器記憶體不足」——而四次的殘骸留在 `ps` 上：

```
a185_127  a16661_127  a30346_127  a71415_127     同一個編號，四次各卡一個
twoproj-*/x2c ×5                                  每跑一次那支探針就留一個
```

全部 `STAT = UE`（不可中斷的等待 ＋ 正在離開）、**RSS 416 bytes**——那個行程
**根本沒進到使用者程式碼**就卡住了。而同一時刻 `memory_pressure` 說 **45% 空閒**。

⚠️ `execSync` 的 `timeout` **救不了**卡在 `UE` 的行程（訊號送得出、它收不到），
於是 `tests/probes/two-projections-behave.test.ts` 會**永遠等下去**（0% CPU）。

🟢 **診斷三步**（這一天用到兩次，兩次都對）：

```
① 一批一直失敗 → 先問那一批裡是不是只有【一個】成員在失敗（拆開跑）
② ps -axo stat,command | awk '$1 ~ /^U/'   ← 上一次失敗留下了什麼
③ memory_pressure                          ← 先確認「記憶體不足」是不是真的
```

> **「記憶體不足」是系統送出的訊息，
> 而它與「我的批次為什麼跑不完」是兩個問題。**

⚠️ 卡在 `UE` 的行程**殺不掉**，只有重開機清得掉——那是使用者的機器，要問過他。

🔴 **而它的累積速度要知道**：`studycpp-behaves` 跑一次留下 **約 67 個**
（逾時被 SIGKILL 而卡在核心裡的參照程式——「參照跑不完 20」那一欄的那些）。
一天下來累積到 **379 個**。行程表撐得住，而**它會讓 e2e 假紅**。

🔴 **e2e 的假紅長什麼樣**（2026-09-20 同一天兩次，而**兩次是不同的測試**）：

```
第一次   c-target「#include 在 C 目標下要換掉」        單獨重跑 → 五支全綠
第二次   flow-layout「刪掉一行——其餘的不動」 16.3 秒   單獨重跑 → 3.4 秒綠
```

⚠️ **兩次的錯誤都是 `expect(locator).toBeVisible() failed`**——不是斷言不符，
是**等不到畫面**。而 e2e 裡大量 `waitForTimeout(600)` 這種固定等待，
在機器忙的時候就不夠。

🟢 **判準**：紅的那一支，**單獨重跑**一次。

```
單獨也紅  → 是你改壞的
單獨綠了  → 先問當時機器上還有什麼在跑（pgrep -f "vitest|playwright|studycpp"）
```

⚠️ 而更根本的處置是**不要留下背景任務**：這一天有一個兩小時前就卡住的
`studycpp-behaves` 一直沒被停掉，而它是第一次假紅的同謀。

🟢 **記憶體不夠跑整輪時**：`npm run build` ＋ `npm run preview` 先做掉
（`reuseExistingServer` 會重用它），再 `npx playwright test --shard=N/4`
——整輪一起跑的尖峰在**建置**那一段，不在測試。

> **一支在乾淨機器上綠、在忙碌機器上紅的測試，量到的不是你的改動。**

🔴 **e2e 那一列是 2026-08-25 加的，而它是那天最貴的教訓**：一天改了六刀 UI，
每一刀都跑了全套（5600+ 綠）＋ 開瀏覽器實測，**而 e2e 一次都沒跑**
——CI 從那天 00:20 起紅，**19 支**，是使用者發現的。

> **`npm test` 驗的是「這些函式做對了嗎」；
> e2e 驗的是「使用者按得到的東西還在不在」。**

🔴 **「改了輸出的文字表示」那一列是 2026-09-19 加的**，而它是**第 194 刀留下、
第 197 刀才發現**的：那一刀把 `0.0/0.0` 的輸出從 JavaScript 的 `NaN` 改成 C++ 真正印的
`nan`——**對的改動**。而課文 `arduino/13-溫濕度` 的 `check.stdout` 寫死了 `NaN`，
於是 e2e 紅，而**沒有人跑 e2e**（那一刀改的不是「會 lift 成哪些元件」，
所以當時那張表沒有叫我跑）。

> **一次「輸出的文字表示變了」的改動，會讓每一份【寫死了那段文字】的東西過期
> ——而課文是其中一種，它不在 `npm test` 裡。**

🔴 **而同一刀還留下第二個東西，它更貴**：`interpreter-matches-compiler` 新加的
「`0.0/0.0` 是 `nan`」那一條，判準是**印出來的字串**：

```
本機   Apple clang（libc++）    nan
CI     GNU g++（libstdc++）     -nan
```

NaN 的**正負號是未指定的**，所以那條判準綁在本機那台編譯器上。
**CI 因此從第 194 刀起紅了三次合併**（194–195、196、以及在 197 修好之前）。

⚠️ 這與 2026-09-17／09-18 的標頭那兩次是**同一個形狀的第三次**。
> **本機那一台比 CI 那一台寬鬆的地方，量不出來的不是缺陷
> ——是【我的判準有多寬】。**

🟢 **處方**：拿參照編譯器當權威時，**先問那一段的答案有沒有被標準定死**。
`inf` 有（除法①③照舊比字串）；NaN 的正負號沒有 ⟹ 判準換成
「那個值不等於它自己」（`c != c`，兩台機器都印 `1`）。

🔴 **第二列是 2026-09-18 加的**（[history/254]）：那一刀讓 `sort(v.begin(), v.end())` 的
`v.begin()` 從**一串文字**變成**一顆積木**，於是**同一份課文用到的元件變多了**
——而課文沒有宣告它，學生在課堂上**找不到那塊積木**。

⚠️ 常駐的第一百一十四／一百二十八條**都跑了、都綠**：它們量的是課文的片段與解答檔，
而 e2e 那一條掃的是**整份課文的每一段程式碼**。

> **兩個名字很像的檢查，差別常常不在判準，在母體。**

⚠️ 而「開瀏覽器實測」也擋不住：**實測的是剛做的那條路，
不是那些沒有人再去看的舊路**。

🔴 **對照圖那一列是 2026-09-05 加的**，而它也是使用者發現的：課文頁上
`1000000LL * 1000000LL` 的積木寫著 `0 × 0`——**而產品是對的**，
過期的是那 68 張圖（在 `field_number → field_input` 之前產的）。

```
npx playwright test --config=tools/demo/playwright.demo.config.ts record-blockmaps
```

> **一份產物的過期，有兩種來源：輸入變了，或者【產它的那台機器變了】。
> 只錨住前者的檢查，會在後者發生時保持全綠。**

🔴 **「拿真實語料重量一次」那一列是 2026-09-09 加的**，而它也是使用者給的：
他交來學生的練習 repo（218 個 `.cpp`、7327 行，AP325／TIOJ／zeroJudge／APCS）。

```bash
git clone https://github.com/core-keeper/StudyCpp /tmp/StudyCpp
STUDYCPP_DIR=/tmp/StudyCpp npx vitest run tests/probes/studycpp-
```

⚠️ **沒有 `STUDYCPP_DIR` 那兩支探針就跳過**——語料是別人的 repo，沒有收進來。

🔴 **而 `/private/tmp` 會被系統清掉**（2026-09-21 撞到）：clone 好的語料
放在 scratchpad 底下，隔一段時間再跑，**目錄結構還在而 `.cpp` 全部不見**。

```
同一棵 0｜走樣 0｜產碼丟例外 0        ← 每一格都是 0，看起來像「完美」
```

🟢 **抓到它的是探針自己的入口條件斷言**（`★ 每一支都要載得進去` 紅了）
——那一條問的是「母體不是空的」。

> **一個「零缺陷」的讀數，與一個「零樣本」的讀數，數字長得一模一樣
> ——分開它們的只有入口條件。**

處方：重跑前先 `find $STUDYCPP_DIR -name "*.cpp" | wc -l`，不是 218 就重新 clone。
🟢 而**形狀收進來了**：第一百一十五條護欄 `declaration-shapes-roundtrip`
（53 條，`npm test` 會跑）。

第一次跑量到的東西：**殘差 0.0%，而 218 支裡 144 支轉一圈回來不是同一棵樹**。

> **殘差量的是「我沒認出來」，而它對「我認錯了」保持沉默
> ——而後者才會讓使用者的程式碼變成另一支程式。**

🔴 **而那還不夠**（2026-09-10，使用者：「你到底有沒有整個仔細測過一遍？」）。
一個宣告有**五個面向**，而上面那兩支只量了前兩個（⑤是 2026-09-16 才補上的）：

| 面向 | 怎麼量 | 紅了的症狀 |
|---|---|---|
| ① 產出的程式碼 | `lift → 產碼` | 產出不一樣 |
| ② 語義的不動點 | `lift → 產碼 → 再 lift` | 來回一趟就變 |
| 🔴 ③ 載得進工作區嗎 | `render → Blockly load` | **一片空白**（不是少一行） |
| 🔴 ④ 走一趟積木回來 | `render → extract → 產碼` | 學生一動積木，程式碼就少東西 |
| 🔴 ⑤ **跑出來一不一樣** | `execute` vs **參照編譯器** | **形狀全對，而它印出別的東西** |

🔴 **⑤ 是 2026-09-16 加的**，而它也是使用者問出來的：「你有幫我驗證語料庫的
執行結果與模擬的是一致的嗎？」——沒有。①②③④**四個都是形狀**，
而四支 `studycpp-*` 探針裡 `interpret`／`execute` 的出現次數是 0。

```bash
STUDYCPP_DIR=/tmp/StudyCpp SEMORPHE_REFCC_INCLUDE=$PWD/tests/fixtures/refcc-shim \
  npx vitest run tests/probes/studycpp-behaves        # ⑤，要參照編譯器
```

⚠️ **測資是【問程式自己】生的**：語義樹裡有每一次讀取的型別與順序。
判準不是「這份輸入對那一題有意義」，是**兩邊餵同一份**。
⚠️ `bits/stdc++.h` 是 GCC 專屬的，macOS 上要 `SEMORPHE_REFCC_INCLUDE` 指到墊片
——不指的話 206/218 會假性編不過。

第一次跑量到：**兩邊都跑完 91 支，41 支輸出不同**，收斂成兩族，
而**兩族的 lift 與 generate 都是對的**（`cout << '\n'` 印成反斜線、
`int a{7}` 變成 1）。修完 37 → 14。

> **一個只錯在 `execute` 那一路的缺陷，形狀是完美的
> ——而形狀完美正是它活下來的原因。**

🔴 **而它的代價要知道**：那支探針要編 204 支含 `bits/stdc++.h` 的程式
（單支峰值 94 MB）。並行度**刻意壓在 3**——8 那次把使用者的機器打掛了
（[history/240]，2,880 次 jetsam ＋ 重開機）。

```bash
STUDYCPP_DIR=/tmp/StudyCpp npx vitest run tests/probes/studycpp-loadable   # ③
```

而 ①②③④ 的全掃（15 種型別 × 20 種宣告形狀）**要參照編譯器**，跑一次約兩分鐘
——它留在 `tests/probes/`，不進 `npm test`。常駐的是它抽出來的形狀：
第一百一十五（產出的程式碼）· 一百一十七（載得進工作區）· 一百一十八（走一趟積木回來）。

⚠️ **判準有三層，少一層就會追到雜訊或漏掉缺陷**：

```
① 先問參照編譯器「這一段是合法的 C++ 嗎」  不問 → 追自己造的雜訊（stack<int> a(5) 沒有那個建構子）
② 每一個宣告的名字都要被觀察              不觀察 → 第二個宣告子蒸發也是綠的
③ 文字不同 ≠ 錯，行為不同才是             不分 → 121 筆正規化會被算成缺陷
```

> **一份「有 N 個缺陷」的報告，先問那 N 裡有幾個是量測工具自己的。**

🔴 **而「參照編譯器」不是一個東西**（2026-09-18，CI 抓到七支）：

```
本機   Apple clang（libc++）    <set> 遞移帶進 <deque>、<map> 帶進 <queue>／<tuple>
CI     GNU g++（libstdc++）     不帶
```

於是七支手列標頭的測試**本機全綠、CI 全紅**，訊息還說「測試自己的問題」
——那句話是對的，只是它說不出**是哪一台**參照編譯器。

⚠️ 同一個坑咬過兩次：2026-09-17 缺 `<set>`（當時的修法是補上那一個標頭），
2026-09-18 缺 `<queue>` 與 `<tuple>`。**補一個實例不會讓下一個不發生。**

> **本機那一台比 CI 那一台寬鬆的地方，量不出來的不是缺陷
> ——是【我的判準有多寬】。**

🟢 **處方**：餵給參照編譯器的程式一律 `#include <bits/stdc++.h>`
（本機由 `SEMORPHE_REFCC_INCLUDE` 指到 `tests/fixtures/refcc-shim`，CI 上是真的 GCC 標頭），
而第 120 條護欄 `audit-refcc-headers` 盯著還在手列的檔數。

⚠️ 現在 `audit-lesson-blockmaps` 會替你紅（它比對 `engineHash`），
所以**不用記得**——但要知道紅的時候該跑什麼。

判準一句話：**你改的是「行為」，還是「這個 repo 的形狀」？** 後者才需要護欄。

🔴 **而「跑一塊固定的子集」在這個專案幾乎沒有用**（實測）：排掉最慢的五個檔
省下 **0 秒**（它們被並行 overlap 掉）；扣掉全部 54 條護欄跑全套**沒有變快**。
有效的子集是「**與這次改動相關的那幾個檔**」，不是「一塊比較小的固定範圍」。

⚠️ **測試環境預設是 `node`**，碰 DOM 的 20 個檔在檔頭寫
`@vitest-environment happy-dom`。加新測試時如果用到 `document`／`localStorage`／
面板，記得加上——不加的症狀是那個檔紅，不是靜默錯（`src/` 裡零個
「偵測 DOM 存在」的分支，已查證）。

⚠️ **沒有 `npm run lint`**（這一行本來寫著它，而那個 script 不存在）。
型別檢查走 `npx tsc --noEmit`。

## Code Style

TypeScript 5.x: Follow standard conventions

## Recent Changes
- 048-unify-extractor: Added TypeScript 5.x + Blockly 12.4.1 + Blockly（積木渲染/序列化）, Vitest（測試）
- 047-pointer-ref-ux: Added TypeScript 5.x + Blockly 12.4.1, web-tree-sitter 0.26.6, Vite + Blockly（積木渲染）, tree-sitter-cpp（AST 解析）, Vitest（測試）
- 022-topic-system: Added TypeScript 5.x + Blockly 12.4.1, web-tree-sitter 0.26.6, Monaco Editor, Vite


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->

<!-- Knowie: Project Knowledge -->
## Project Knowledge

This project maintains structured knowledge in `knowledge/`:

- **Principles** (`knowledge/principles.md`): Core axioms and derived development principles — the project's non-negotiable rules.
- **Vision** (`knowledge/vision.md`): Goals, current state, architecture decisions, and roadmap.
- **Experience** (`knowledge/experience.md`): Distilled lessons from past development — patterns, pitfalls, and takeaways.

Read these files at the start of any task to understand the project's *why* and constraints.
Additional context may be found in `knowledge/concepts/`, `knowledge/history/`, and `knowledge/draft/`.

Learned procedures live in `knowledge/skills/` (agentskills.io SKILL.md format). If your tool auto-loads skills, they may be projected into your skill directory; otherwise read the relevant `SKILL.md` there and follow it.
<!-- /Knowie -->
