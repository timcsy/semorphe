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
- **語義樹驅動** — 以 Semantic Tree 為 Single Source of Truth，非簡單的文字↔積木映射
- **認知分級** — L0 初學 / L1 進階 / L2 完整，漸進式揭露 C++ 功能
- **多種程式碼風格** — APCS（cout/cin）、競賽（printf/scanf）、Google 風格一鍵切換
- **優雅降級** — 不支援的語法自動降級為原始碼積木，標註信心度
- **VSCode 延伸模組** — 直接在編輯器側邊欄使用積木面板

## 快速開始

```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev

# 執行測試
npm test

# 建置
npm run build
```

## 架構

```
src/
├── core/           # 語義樹、投影引擎、block spec registry
├── languages/      # 語言模組（目前支援 C++）
├── interpreter/    # 語義樹直譯器
└── ui/             # Blockly 面板、Monaco 編輯器、同步控制器
```

核心原則：語義樹（Semantic Tree）是唯一的真實來源。積木（Blockly）和程式碼（Monaco）都是語義樹的投影。所有轉換都透過語義層進行，不直接在兩種視覺表示之間映射。

## 概念管線（Concept Pipeline）

Semorphe 提供一套 Claude Code skill，用於系統化地新增語言概念支援。從研究語言特性到完整整合，全程由 AI 輔助完成。

### 概覽

```
/concept.discover  →  /concept.generate  →  /concept.roundtrip  →  /concept.fuzz  →  /concept.integrate
    研究 & 分類         產生實作產出物          目標性 round-trip        資訊隔離盲測          最終關卡 & 註冊
```

或直接使用端到端管線一次完成：

```
/concept.pipeline cpp <algorithm>
```

### 各 Skill 說明

| Skill | 指令 | 用途 |
|-------|------|------|
| **概念探索** | `/concept.discover {lang} {target}` | 研究函式庫/語言特性，萃取概念、按 Topic 層級樹分類、提出命名 |
| **概念產生** | `/concept.generate {lang} {concept}` | 產生 BlockSpec JSON、generator、lifter、渲染映射、測試 |
| **Round-Trip 測試** | `/concept.roundtrip {lang} {concept}` | 對特定程式執行 lift → generate → 比較 stdout 的驗證 |
| **模糊測試** | `/concept.fuzz {lang} {difficulty} {scope} {count}` | 雙代理架構：Agent A（不知實作）出題，Agent B 驗證正確性 |
| **整合** | `/concept.integrate {lang} {concept}` | 執行所有驗證（tsc、test、round-trip），通過後完成註冊 |
| **端到端管線** | `/concept.pipeline {lang} {target}` | 串接上述 5 個 skill，一個指令從研究到整合 |
| **概念重構** | `/concept.refactor {lang} audit\|fix\|migrate\|full` | 審計四路完備性與信心等級、修復缺失產出物、遷移 JSON pattern、清理技術債 |

### 使用範例

```bash
# 探索 C++ <algorithm> 標頭檔的概念
/concept.discover cpp <algorithm>

# 為特定概念產生實作
/concept.generate cpp sort_range

# 驗證 round-trip 正確性
/concept.roundtrip cpp sort_range

# 用盲測找出邊界案例
/concept.fuzz cpp medium loops 20

# 完整管線：從研究到整合
/concept.pipeline cpp <algorithm>

# 快速管線（跳過模糊測試）
/concept.pipeline python list comprehension --skip-fuzz

# 只處理特定概念
/concept.pipeline java Stream API --concepts=stream_map,stream_filter

# 審計現有概念實作（四路完備性、信心等級、雙重註冊）
/concept.refactor cpp audit

# 修復特定概念的缺失產出物
/concept.refactor cpp fix cout

# 修復整個 STD 模組
/concept.refactor cpp fix vector

# 修復該語言所有概念
/concept.refactor cpp fix all

# 將特定 hand-written lifter 遷移至 JSON pattern
/concept.refactor cpp migrate if

# 完整重構：audit → fix → dedup → migrate → render-fix → purge
/concept.refactor cpp full
```

### 檔案存放位置

概念的實作檔案依層級存放：

| 層級 | blocks.json | concepts.json | generators | lifters |
|------|-------------|---------------|------------|---------|
| **核心語法** | `src/languages/{lang}/core/blocks.json` | `src/languages/{lang}/core/concepts.json` | `src/languages/{lang}/core/generators/` | `src/languages/{lang}/core/lifters/` |
| **標準庫模組** | `src/languages/{lang}/std/{module}/blocks.json` | `src/languages/{lang}/std/{module}/concepts.json` | `src/languages/{lang}/std/{module}/generators.ts` | `src/languages/{lang}/std/{module}/lifters.ts` |

詳細的 skill 定義在 `.claude/skills/concept-*/SKILL.md`。

## VSCode 延伸模組

```bash
cd vscode-ext
npm install
node esbuild.mjs
# 按 F5 啟動 Extension Development Host
```

詳見 [vscode-ext/README.md](vscode-ext/README.md)。

## 授權

MIT
