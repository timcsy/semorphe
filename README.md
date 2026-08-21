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

- **雙向同步** — 修改積木即時更新程式碼，修改程式碼即時更新積木
- **語義樹驅動** — 語義樹是 Single Source of Truth，**不是**文字↔積木的直接映射
- **多語言** — C++ 與 Python，各自有自己的文法、產生器與課程
- **漸進揭露** — 每個課程有自己的層級樹（L0/L1/L2…），工具箱依層級過濾
- **多種程式碼風格** — APCS（cout/cin）、競賽（printf/scanf）、Google、Python 一鍵切換
- **誠實降級** — 認不出來的語法變成**看得見的**灰色積木，原文一字不動；
  ⚠️ 而**每個語言用自己的降級積木**，不會借別的語言的
- **IDE 延伸模組** — VSCode 與 Arduino IDE（Theia）共用同一份，程式碼那一格交給宿主的編輯器

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
├── core/         # 語義樹、投影引擎、宣告登記處
├── components/   # 🔴 元件膠囊 —— <scope>/<name>/，一顆元件一個資料夾
├── languages/    # 語言套件（cpp / python）：解析器、課程、目標、風格、分類
├── interpreter/  # 語義樹直譯器
├── ui/           # Blockly 面板、Monaco、同步控制器、積木建構子
└── vscode/       # IDE 延伸模組（VSCode + Arduino IDE 共用）
```

**核心原則**：語義樹是唯一的真實來源。積木與程式碼都是它的投影，
所有轉換都經過語義層，**不直接在兩種視覺表示之間映射**。

### 一顆元件長什麼樣

```
src/components/<scope>/<name>/
  component.json        身分／參數／接點／角色／五路各自在哪
  lift-pattern.json     AST → 語義樹（純資料；要跑邏輯時改用 lift-strategy.ts）
  generate.ts           語義樹 → 原始碼
  execute.ts            語義樹 → 執行行為（沒有這一路要寫 null ＋ 理由）
  forms/blocks.json     積木形態（render 與 extract 共用同一份）
  labels/{zh-TW,en}.json
  spec.test.ts
```

🟢 **加一顆元件＝新增一個資料夾**：登錄表用 `import.meta.glob` 掃描，
不需要編輯任何共用檔。

## AI 輔助的開發管線

Semorphe 把重複的開發流程固化成 **skill**（`knowledge/skills/`，投影到 `.claude/skills/`）。
它們是**這個專案的記憶**，不只是模板——每一條規矩後面都有一次翻車。

### 加一顆元件

```
/component-pipeline {lang} {target}
```

它串起六個階段：

| 階段 | Skill | 做什麼 |
|---|---|---|
| 1 | `component-discover` | 研究函式庫／語言特性，提出概念與命名 |
| 2 | `component-generate` | 產一顆膠囊：宣告 ＋ 五路 ＋ 形態 ＋ 標籤 ＋ 測試 |
| 3 | `component-roundtrip` | 原始碼 → lift → generate → 執行，比對 stdout |
| 4 | `component-fuzz` | 雙代理資訊隔離的盲測 |
| 5 | `component-integrate` | 最終關卡：全部驗證跑完才算數 |
| 6 | `verify-in-browser` | 🔴 **開瀏覽器看**——前五階段全綠而使用者一看就發現的缺陷 |

### 加一個**語言**

```
/add-language
```

⚠️ **與上面那條是不同的路**——元件管線假設語言已經在了。
加一個語言要處理文法歸屬、四個登記處、結構性 lift pattern、wasm 出貨。

### 其他

| Skill | 用途 |
|---|---|
| `component-refactor` | 審計與修復既有膠囊（主力是護欄報表，它讀報表） |
| `component-rename` | 大規模改身分／參數名——**必附一次性存檔遷移** |
| `build-guardrail` | 把一條規範變成**會變紅**的機械檢查 |
| `manual-acceptance` | 給那些永遠變不紅的規範寫一張人按得完的清單 |
| `diagnose-in-browser` | 已知有問題時在瀏覽器裡定位 |
| `ship-extension` | 把一次改動交到兩個 IDE 手上 |

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
| `concepts/` `history/` `episodes/` `draft/` | 概念、因果軌跡、完整現場、還沒定案的 |

⚠️ **接手任何工作之前先讀那三個檔**——這個專案的多數規矩都有一次具體的災難在後面，
而**那個災難不在程式碼裡**。

## 授權

MIT
