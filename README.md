<p align="center">
  <img src="assets/logo/semorphe-dark.svg" width="128" height="128" alt="Semorphe Logo">
</p>

<h1 align="center">Semorphe</h1>

<p align="center">
  <strong>唯一真實，各式投影。</strong><br>
  解構語法之散，重塑形態之模。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/language-TypeScript-blue" alt="TypeScript">
  <img src="https://img.shields.io/badge/blockly-12.4.1-4285F4" alt="Blockly">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License">
</p>

---

**Semorphe**（散模費，σημορφή）是一套以語義樹為核心的程式教學工具，讓程式碼與積木之間能雙向即時轉換。

名稱由希臘文 σῆμα（語義）與 μορφή（形態）組合而成 — 一棵語義樹是唯一真實，積木與程式碼只是它的不同投影。

## 特色

- **雙向同步** — 改積木，程式碼立刻跟著變；改程式碼，積木也立刻跟著變
- **中間隔著一棵樹** — 兩邊都不直接對映到對方，而是各自對映到一棵**語義樹**。
  那棵樹記的是「這段程式在做什麼」，不是「它怎麼寫」
- **多語言** — 目前 C++ 與 Python，各自有自己的解析器、程式碼產生器與課程
- **由淺入深** — 每個課程分成幾關，工具箱只給這一關該有的積木
- **多種程式碼風格** — APCS（`cout`/`cin`）、競賽（`printf`/`scanf`）、Google、Python 一鍵切換
- **看不懂就承認** — 系統認不出來的語法**不會被丟掉，也不會被猜**：
  它變成一顆灰色積木，原文一字不動地放在裡面。
  ⚠️ 而每個語言用**自己的**灰色積木，不會拿別的語言的來充數
- **IDE 延伸模組** — VSCode 與 Arduino IDE 共用同一份，程式碼那一格交給編輯器本身

## 快速開始

```bash
npm install
npm run dev          # 開發伺服器
npm test             # 單元／整合測試
npm run test:e2e     # Playwright
npm run build        # tsc + vite build
npm run build:vscode # 打包 IDE 延伸模組
npm run install:ide  # 裝進本機的 VSCode / Arduino IDE
```

## 架構

```
src/
├── core/         # 語義樹本身、兩個方向的轉換引擎、各語言登記自己資料的地方
├── components/   # 一顆「程式概念」一個資料夾（if、迴圈、印出來…）
├── languages/    # 每個語言一包：解析器、課程、目標板子、程式碼風格、工具箱分類
├── interpreter/  # 語義樹直譯器
├── ui/           # Blockly 積木面板、Monaco 程式碼編輯器、兩邊的同步
└── vscode/       # IDE 延伸模組（VSCode + Arduino IDE 共用）
```

**核心原則**：那棵語義樹是唯一的真實。積木和程式碼都只是**它的兩種畫法**
（專案裡叫它們「**投影**」）。任何轉換都先回到樹，
**不會有「積木直接翻成程式碼」這種捷徑**——那正是多數同類工具會漂掉的地方。

### 一顆「元件」是什麼

一個程式概念（`if`、`while`、印出來、變數指派…）＝ 一個資料夾。
專案裡叫它**膠囊**，因為它把那個概念的每一面都裝在同一處：

```
src/components/python/loop_while/          ← Python 的 while 迴圈
  component.json        它叫什麼、有哪些欄位、可以接哪些子積木
  lift-pattern.json     怎麼從【程式碼】認出它
  generate.ts           怎麼把它寫回【程式碼】
  forms/blocks.json     它畫成【積木】長什麼樣（同一份也用來從積木讀回資料）
  execute.ts            執行它會發生什麼事
  labels/zh-TW.json     積木上的中文字（另有 en.json）
  spec.test.ts          它自己的測試
```

那五件事（**認出來 · 寫回去 · 畫出來 · 讀回來 · 執行**）就是一顆元件的全部——
少任何一件都要在 `component.json` 裡**寫明為什麼沒有**，
好讓「刻意不做」與「忘了做」分得出來。

🟢 **加一顆元件＝新增一個資料夾。** 系統自己會掃到它，
不需要去別的檔案登記——所以加東西不會弄壞既有的東西。

## AI 輔助的開發管線

Semorphe 把重複的開發流程寫成 **skill**——給 AI 助理看的操作手冊
（原始檔在 `knowledge/skills/`，用符號連結出現在 `.claude/skills/`）。

它們**不是模板，是這個專案的記憶**：裡面幾乎每一條規矩後面都有一次具體的翻車，
而那次翻車就寫在旁邊。

### 加一顆元件

```
/component-pipeline {lang} {target}
```

它串起六個階段：

| 階段 | Skill | 做什麼 |
|---|---|---|
| 1 | `component-discover` | 查這個函式庫／語法有哪些概念，該怎麼命名、放在第幾關 |
| 2 | `component-generate` | 產出上面那個資料夾裡的每一個檔 |
| 3 | `component-roundtrip` | 程式碼 → 積木 → 再變回程式碼，跑起來比對輸出 |
| 4 | `component-fuzz` | 出題的 AI **看不到實作**，只有這樣它才會問你不會問自己的問題 |
| 5 | `component-integrate` | 最終關卡：型別檢查、全套測試、來回轉換全部通過才算數 |
| 6 | `verify-in-browser` | 🔴 **打開瀏覽器【用眼睛看】**——前五關全綠而使用者一看就發現的缺陷 |

### 加一個**語言**

```
/add-language
```

⚠️ **與上面那條是不同的路**——上面那條假設語言**已經在了**。

從零加一個語言要處理的是另一批東西：接上解析器、
**讓系統知道每條辨識規則是寫給哪個語法的**（少了這一步，
新語言的 `if` 會被當成舊語言的 `if`，而且**不會有任何錯誤訊息**）、
以及四件「這個語言怎麼寫註解」「認不出來時用哪顆灰色積木」之類的登記。

### 其他

| Skill | 用途 |
|---|---|
| `component-refactor` | 檢查與修復既有的元件（它讀的是自動檢查產生的報表，不是自己重掃） |
| `component-rename` | 大規模改名（上千處引用）——**一定要附使用者舊存檔的轉換** |
| `build-guardrail` | 把一條「應該要這樣」的規矩，變成一支**做錯就會變紅**的測試 |
| `manual-acceptance` | 有些規矩測不起來（「按下去看到什麼」）——寫成一張人按得完的清單 |
| `diagnose-in-browser` | 已經知道有問題時，在瀏覽器裡查出是哪一段 |
| `ship-extension` | 把一次改動交到兩個 IDE 手上（這條流程跑了九次才被固定下來） |

完整清單與各自的緣起見 [`knowledge/skills/README.md`](knowledge/skills/README.md)。

## IDE 延伸模組

**已出貨**，VSCode 與 Arduino IDE（Theia 1.57）**共用同一份 `.vsix`**。

```
面板【就是】網頁版的 App，只是程式碼那一格換成宿主的編輯器
```

它開在**編輯器區域的一個分頁**（不是側邊欄），由 `semorphe.openBlocks` 指令喚出。

```bash
npm run build:vscode   # 產出 .vsix
npm run install:ide    # 裝進本機兩個 IDE
```

⚠️ Arduino IDE 的安裝路徑是 `~/.arduinoIDE/plugins/`，
而 **Theia 的解壓快取以「名字」為鍵**——覆蓋 `.vsix` 不會重新解，而它不報錯。
用 `npm run install:ide`，不要自己複製。

> 🪦 2026-03 的那個原型已於 2026-08-16 退休（教訓見
> [`knowledge/history/069`](knowledge/history/069-vscode原型退休而它的兩個教訓被撈出來.md)），
> 現在這一份是 2026-08 重做的。

## 專案知識庫

這個專案的 **why** 記在 [`knowledge/`](knowledge/)，而不是散在 commit 訊息裡：

| | |
|---|---|
| [`principles.md`](knowledge/principles.md) | 根公理與衍生原則——不可協商的那些 |
| [`vision.md`](knowledge/vision.md) | 定位與**還活著的**路線圖（完成的收斂成一行 ＋ 指標） |
| [`experience.md`](knowledge/experience.md) | 從翻車裡蒸餾出來的教訓 |
| `concepts/` | 反覆出現的概念，各自一篇 |
| `history/` | 「為什麼變成現在這樣」的因果紀錄——每次改變都留一筆 |
| `episodes/` | 值得重看的完整除錯現場 |
| `draft/` | 還沒定案的想法（沒有被用到就會自然淡掉） |

⚠️ **接手任何工作之前先讀那三個檔**——這個專案的多數規矩都有一次具體的災難在後面，
而**那個災難不在程式碼裡**。

## 授權

MIT
