---
name: concept-refactor
description: >
  審計、修復並重構 Semorphe 已有的語言概念實作。
  偵測四路完備性缺口、信心等級違規、雙重註冊、死概念，
  並自動修復缺失的產出物。用於清理技術債和確保第一性原理合規性。
  支援任何語言。
user-invocable: true
---

> **語言指示**：所有輸出文件（報告、摘要、註解）必須使用**當前對話的語言**撰寫。下方模板僅為結構參考，實際用語應配合使用者的語言設定。

## ⛔ 調用要求

此 skill **必須透過 Skill tool 調用**，不可手動替代。

**完成時必須輸出完成標記**（見最後一節）。

# 概念重構與醫治

## 使用者輸入

```text
$ARGUMENTS
```

參數格式：

### 審計模式（唯讀，不修改程式碼）

- `{lang} audit` — 完整審計：四路完備性 + 信心等級 + 雙重註冊 + 渲染一致性
- `{lang} audit completeness` — 只審計四路完備性
- `{lang} audit confidence` — 只審計信心等級合規性
- `{lang} audit dedup` — 只審計雙重註冊
- `{lang} audit render` — 只審計渲染一致性
- `{lang} audit i18n` — 只審計 i18n 標籤風格一致性

### 醫治模式（診斷 + 修復）

- `{lang} fix {concept}` — 診斷並修復單一概念的所有缺失路徑
- `{lang} fix {module}` — 診斷並修復整個 STD 模組（如 `fix vector`、`fix cmath`）
- `{lang} fix all` — 診斷並修復該語言所有概念
- `{lang} fix --dry-run` — 只診斷不修復，顯示會做什麼

### 重構模式（技術債清理）

- `{lang} migrate {concept}` — 將 hand-written lifter（AST→SemanticNode）遷移至 JSON pattern
- `{lang} migrate all` — 遷移所有可遷移的概念（注意：此遷移僅涉及 lift 路徑，extract 路徑已統一由 PatternExtractor 處理）
- `{lang} dedup` — 清除雙重註冊
- `{lang} render-fix` — 修復渲染一致性問題
- `{lang} i18n-fix` — 修復 i18n 標籤風格不一致問題

### 清理模式

- `{lang} purge-dead` — 移除完全無功能的死概念（registered but zero implementation）

### 組合模式

- `{lang} full` — 依序執行 audit → fix all → dedup → migrate all → render-fix → 最終驗證

## 背景

隨著概念數量增長，實作可能出現五類問題：

1. **四路不完備**（P2 §2.2）：概念只有部分路徑（如有 generator 但沒 lifter），導致管線斷裂
2. **信心等級違規**（P1 §2.1）：composite pattern 未經語義驗證就設 `high`，`warning` 從未使用
3. **雙重註冊**：同一 AST 節點類型在多個 lift 來源中重複註冊（JSON pattern + BlockSpec astPattern + liftStrategy 等）。注意：BlockExtractorRegistry 已刪除，不再有 hand-written extractors；extraction 統一由 PatternExtractor 處理
4. **宣告式不足**：可用 JSON pattern 表達的邏輯仍在 TypeScript 中
5. **死概念**：在 concepts.json 中註冊但完全沒有實作的概念
6. **i18n 標籤不一致**：積木標籤風格混亂（描述式 vs 語法式、中文 vs 英文品質不一、tooltip 重複 message0）
7. **Expression counterpart 缺失 blockDef**：expression counterpart 積木只有 `{type: "..."}` 而無完整 args0，導致 PatternExtractor auto-derive 失敗

## 前置作業

閱讀以下檔案以理解目前實作：

- `src/core/types.ts` — SemanticNode、ConceptId
- `src/core/lift/lifter.ts` — 優先權鏈
- `src/core/lift/pattern-lifter.ts` — pattern types 和信心等級設定邏輯
- `src/languages/{lang}/core/blocks.json` 和 `src/languages/{lang}/std/*/blocks.json` — BlockSpec
- `src/languages/{lang}/core/concepts.json` 和 `src/languages/{lang}/std/*/concepts.json` — 概念註冊
- `src/languages/{lang}/core/generators/` — generator 函式
- `src/languages/{lang}/core/lifters/` — lifter 註冊
- `src/languages/{lang}/lift-patterns.json` — JSON pattern
- `src/interpreter/executors/` — executor 註冊
- `tests/` — 測試檔案

---

## 模式一：Audit（審計）

### A1. 四路完備性掃描

對該語言所有已註冊的概念（從 `concepts.json` 收集），逐一檢查六條路徑：

```bash
# 收集所有概念 ID
cat src/languages/{lang}/core/concepts.json src/languages/{lang}/std/*/concepts.json | \
  node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); j.forEach(c=>console.log(c.conceptId))"
```

對每個概念 ID，搜尋：

| # | 路徑 | 搜尋位置 | 搜尋方式 |
|---|------|---------|---------|
| 1 | **Lift** | `lifters/*.ts` + `lift-patterns.json` | grep `conceptId` 或 `createNode('{concept}')` |
| 2 | **Render** | `blocks.json` (core + std) | grep `"conceptId": "{concept}"` |
| 3 | **Extract** | 同上，確認 `renderMapping` 有 fields/inputs（PatternExtractor auto-derive）；動態概念需有 `dynamicRules`；expression counterpart 需有完整 blockDef args0 | 檢查 BlockSpec 結構 |
| 4 | **Generate** | `generators/*.ts` 或 `std/*/generators.ts` | grep `generators.set('{concept}')` |
| 5 | **Execute** | `src/interpreter/executors/*.ts` | grep `register('{concept}')` 或 `'{concept}'` |
| 6 | **Test** | `tests/` | grep `'{concept}'` 在 `.test.ts` 檔案中 |

輸出完備性矩陣：

```markdown
### 四路完備性矩陣

| 概念 | Lift | Render | Extract | Generate | Execute | Test | 完整？ |
|------|------|--------|---------|----------|---------|------|--------|
| var_declare | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ 6/6 |
| cpp:cout | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ⚠️ 5/6 |
| cpp:vector_push | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 💀 0/6 |

### 統計
- 完整（6/6）：{N} 個（{%}）
- 部分（1-5/6）：{N} 個（{%}）
- 死概念（0/6）：{N} 個（{%}）
```

### A2. 信心等級合規掃描

掃描所有 lifter 和 pattern-lifter 程式碼，檢查：

1. **`confidence: 'warning'` 使用頻率**：搜尋所有 `confidence` 設定，統計各等級使用次數
2. **Composite pattern 語義驗證**：讀取 `pattern-lifter.ts` 的 composite matcher，檢查結構匹配後是否有語義驗證步驟
3. **一對多映射無 warning**：找出所有映射到同一 AST nodeType 的不同概念，確認 lifter 在歧義情境設了 `warning`
4. **降級路徑存在性**：確認每個 lifter 在無法識別時有 `raw_code` 降級

```markdown
### 信心等級合規報告

| 檢查項 | 狀態 | 詳情 |
|--------|------|------|
| `warning` 使用 | ❌ 從未使用 | 0 處設定 warning |
| composite 語義驗證 | ❌ 缺失 | pattern-lifter.ts:281 直接設 high |
| 一對多映射 warning | ⚠️ 部分 | call_expression 有 3 個概念但未設 warning |
| raw_code 降級 | ✅ | 所有 lifter 都有降級路徑 |
```

### A3. 雙重註冊掃描

掃描 lift 註冊來源，建立 `{nodeType → [sources]}` 映射表：

| 來源 | 位置 | 優先權 |
|------|------|--------|
| **Hand-written lifter** | `lifter.register(nodeType, fn)` | 最低（PatternLifter 優先）——用於 AST→SemanticNode 的 lift 路徑 |
| **JSON pattern** | `lift-patterns.json` 條目 | 中（patternType + priority） |
| **BlockSpec astPattern** | `blocks.json` 的 `astPattern` 欄位 | 最低（-5 penalty） |
| **LiftStrategy** | `extractors/extract-strategies.ts` 中的 lift strategies | 用於 AST→SemanticNode 的複雜 lift 邏輯 |

**注意**：BlockExtractorRegistry 已刪除。Block→SemanticNode 的 extraction 統一由 PatternExtractor 處理（auto-derive from blockDef args + concept children 或 dynamicRules），不再需要 hand-written extractors。此處的「雙重註冊」專指 **lift 路徑**（AST→SemanticNode）的重複，而非 extract 路徑。

標記：`SHADOW`（被遮蔽）、`FALLBACK`（安全網）、`CONFLICT`（行為不同）。

### A4. Render 一致性掃描

對每個 BlockSpec，檢查：
- 有 strategy 但可 auto-derive → 冗餘
- 無 strategy 但 auto-derive 不足 → 可能錯誤
- Strategy 與 generator 語義不一致 → 違反 Sc4

### A5. i18n 標籤風格掃描

掃描所有 BlockSpec 的 `message0` 和 `tooltip` 引用的 i18n key，對照 `src/i18n/zh-TW/blocks.json` 和 `src/i18n/en/blocks.json` 的翻譯文字，逐一檢查：

**按 category 分組掃描**——同 category 的積木標籤必須使用一致的句式。

| 檢查項 | 通過條件 | 嚴重度 |
|--------|---------|--------|
| **中文描述式** | 包含動詞，不含括號或原始函式名（如 `排序 %1` 而非 `sort( %1 )`） | ⚠️ P1 |
| **英文動詞短語** | 以大寫字母開頭的動詞短語（如 `Sort %1` 而非 `sort( %1 )`） | ⚠️ P1 |
| **函式名未當標籤** | message0 翻譯不等於函式呼叫語法（`.method()` 或 `func()`） | ⚠️ P1 |
| **語言關鍵字未當標籤** | 標籤不以原始語言關鍵字開頭（C++ 的 `const`、`virtual`、`auto`、`typedef`、`using`、`override`、`constexpr`；Python 的 `def`、`class`、`lambda`；Java 的 `abstract`、`synchronized` 等） | ⚠️ P1 |
| **語法符號未當標籤** | 標籤不含語言特殊語法（C++ 的 `static_cast<>()`, `[&]()`, `~ ClassName()`, `operator+`；Python 的 `@decorator`；Java 的 `<T>` 等） | ⚠️ P1 |
| **tooltip 非重複** | tooltip 翻譯與 message0 翻譯不同，且提供額外說明 | ⚠️ P2 |
| **同類風格一致** | 同 category 內所有標籤使用相同句式模式 | ⚠️ P2 |
| **i18n key 完整** | 所有 `%{BKY_...}` key 在兩個語系檔中都有定義 | ❌ P0 |

**P1 掃描必須覆蓋的模式**（缺一不可）：

| 模式 | 正則/搜尋方式 | 說明 |
|------|-------------|------|
| `.method()` 語法 | `\.\w+\(` | 如 `%1 .push( %2 )`, `%1 .empty()`, `%1.append(%2)` |
| `func()` 語法 | `\w+\(\s*%` | 如 `abs( %1 )`, `sizeof( %1 )`, `len(%1)` |
| 語言關鍵字 | 依語言而定（見下方清單） | 關鍵字出現在 MSG0 值中 |
| Lambda/閉包語法 | `\[\s*%.*\]\s*\(` 或 `lambda\s+%` | 如 `[ %1 ] ( %2 )`, `lambda %1: %2` |
| 解構子/特殊語法 | `~\s*%` 或 `@\s*%` | 如 `~ %1 ()`, `@%1` |
| 中英完全相同 | zh-TW 值 == en 值 | 表示中文根本沒翻譯 |

**各語言關鍵字清單**（掃描 MSG0 值時使用）：

| 語言 | 關鍵字正則 |
|------|-----------|
| C/C++ | `\b(const\|constexpr\|auto\|typedef\|using\|virtual\|override\|operator\|namespace\|sizeof\|static_cast\|dynamic_cast\|reinterpret_cast\|const_cast\|new\|delete\|template)\b` |
| Python | `\b(def\|class\|lambda\|import\|from\|with\|yield\|async\|await\|global\|nonlocal)\b` |
| Java | `\b(abstract\|synchronized\|implements\|extends\|instanceof\|throws\|volatile\|transient\|native)\b` |
| JavaScript | `\b(function\|class\|async\|await\|yield\|typeof\|instanceof\|import\|export)\b` |

新增語言時，將該語言的關鍵字加入此清單。

```markdown
### i18n 標籤風格報告

| Category | 概念 | 中文 | 英文 | 問題 |
|----------|------|------|------|------|
| math | cpp_abs | `abs( %1 )` | `abs( %1 )` | ⚠️ 函式名當標籤 |
| math | cpp_sqrt | `sqrt( %1 )` | `sqrt( %1 )` | ⚠️ 函式名當標籤 |
| containers | cpp_vector_size | `%1 的大小` | `Size of %1` | ✅ |

### 統計
- P0（key 缺失）：{N} 個
- P1（風格違規）：{N} 個
- P2（品質建議）：{N} 個
- 合格：{N} 個（{%}）
```

### A6. 輸出完整審計報告

將報告儲存到 `tests/reports/refactor-audit-{lang}-{timestamp}.md`。

報告結構：

```markdown
## 概念審計報告（{language}）— {date}

### 總覽
- 已註冊概念：{N}
- 四路完整：{N}（{%}）
- 部分實作：{N}（{%}）
- 死概念：{N}（{%}）
- 信心合規：{PASS/FAIL}
- 雙重註冊：{N}
- Render 問題：{N}
- i18n 標籤問題：{N}（P0: {N}, P1: {N}, P2: {N}）

### 四路完備性矩陣
{表格}

### 信心等級合規
{報告}

### 雙重註冊
{表格}

### Render 一致性
{表格}

### i18n 標籤風格
{表格}

### 建議修復優先順序
1. {最高優先}
2. ...
```

---

## 模式二：Fix（修復）

### 修復流程

對每個目標概念，執行以下診斷和修復流程：

#### H1. 診斷

讀取審計結果（或即時掃描），確定缺失的路徑：

```
概念 {concept_id} 診斷：
  Lift:     ❌ 缺失 — 無 lifter 註冊
  Render:   ❌ 缺失 — 無 blocks.json 條目
  Extract:  ❌ 缺失 — 無 renderMapping
  Generate: ✅ 存在 — generators.ts:42
  Execute:  ❌ 缺失 — 無 executor 註冊
  Test:     ❌ 缺失 — 無測試檔

  需修復：4 條路徑
```

#### H2. 修復策略決定

根據缺失路徑和概念類型，決定修復策略：

| 情境 | 策略 |
|------|------|
| 缺 Lift 但有 Generate | 從 generator 反推 AST 結構，產生 lifter |
| 缺 Render/Extract 但有 Lift | 從 lifter 的 SemanticNode 結構推導 BlockSpec |
| 缺 Generate 但有 Lift | 從 lifter 的輸出結構產生 generator |
| 缺 Execute | 分析概念是否可執行，產生 executor 或 noop |
| 缺 Test | 根據已有的 lift/generate 產生基本測試 |
| 死概念（0/6） | 評估是否該保留——如果有探索報告則產生全部，否則建議 purge |

#### H3. 執行修復

**必須逐概念修復，每修一個就驗證。**

對每個缺失路徑：

1. **讀取現有產出物**——理解概念的語義結構（properties、children、用途）
2. **參考同語言的鄰近概念**——匹配程式碼風格
3. **產生缺失的產出物**——遵循 `/concept.generate` 的規則
4. **驗證**：
   ```bash
   npx tsc --noEmit  # 型別檢查
   npm test          # 測試不能破壞
   ```

**修復產出物的品質要求**（與 `/concept.generate` 相同）：

- **Lifter**：必須設定正確的信心等級（見信心等級規則）
- **BlockSpec**：必須有完整的 `renderMapping`（fields + inputs），i18n 使用 `%{BKY_...}` key，**標籤必須符合 `/concept.generate` 步驟二的 i18n 風格規範**（中文描述式、英文動詞短語、函式名不當標籤、tooltip 補充說明、同類一致句式）
- **Generator**：必須處理缺失子節點（空字串或預設值）
- **Executor**：可執行概念需實作邏輯，宣告性概念需 noop
- **Test**：必須包含 lift、generate、round-trip 三種測試

#### H4. 信心等級修復

如果審計發現信心等級問題：

1. **Composite pattern 無語義驗證**：在 composite match 成功後加入語義驗證 hook
   ```typescript
   // 在 pattern match 成功後，驗證子節點概念合理性
   if (matchResult.confidence === 'high' && isCompositePattern(pattern)) {
     // 檢查子節點概念是否與 pattern 預期一致
     matchResult.confidence = semanticValidation(matchResult) ? 'high' : 'warning'
   }
   ```

2. **一對多映射無 warning**：在有多個概念共用同一 AST nodeType 的 lifter 中加入 warning
3. **缺少降級路徑**：加入 `raw_code` fallback

#### H5. 驗證修復結果

每修復一個概念後：

1. `npx tsc --noEmit` — 型別檢查
2. `npm test` — 全部測試通過
3. 重新掃描四路完備性——確認 6/6

#### H6. 輸出修復報告

```markdown
## 修復報告（{language}）— {date}

### 修復摘要

| 概念 | 修復前 | 修復後 | 修復的路徑 |
|------|--------|--------|-----------|
| cpp:cout | 3/6 | 6/6 | +Lift, +Render, +Test |
| cpp:vector_push | 0/6 | 6/6 | +All |

### 統計
- 修復概念數：{N}
- 新增 lifter：{N}
- 新增 BlockSpec：{N}
- 新增 generator：{N}
- 新增 executor：{N}
- 新增測試：{N}
- 信心等級修復：{N}

### 驗證
- TypeScript：✅
- npm test：✅ {N} passed
```

---

## 模式三：Migrate（遷移）

**注意**：此遷移僅涉及 **lift 路徑**（AST→SemanticNode 的 hand-written lifter → JSON pattern）。Extract 路徑（Block→SemanticNode）已統一由 PatternExtractor 處理，無需遷移。`extractors/extract-strategies.ts` 中的 PatternExtractor extraction strategies 操作的是 BlockState JSON（非 Blockly.Block）。

### 遷移決策樹

```
                        ┌─ 純欄位映射？ ──── 是 ──── L1 simple/constrained
                        │
hand-written lifter ────┤─ 需要 transform？── 是 ──── L2 simple + transform
                        │
                        ├─ 按 operator 路由？ 是 ──── L2 operatorDispatch
                        │
                        ├─ 左遞迴收集？ ──── 是 ──── L2 chain
                        │
                        ├─ 多條件結構？ ──── 是 ──┬── 核心邏輯 < 20 行？ ── L3 composite
                        │                        └── 核心邏輯 ≥ 20 行？ ── unmovable
                        │
                        └─ 跨節點狀態/副作用？ 是 ── unmovable
```

### M1. 讀取目標 lifter

讀取 hand-written lifter 的完整實作，理解輸入、條件分支、輸出。

### M2. 判斷可遷移性

| 遷移性 | 條件 | 目標 |
|--------|------|------|
| **L1-ready** | 純欄位映射，無條件分支 | `simple` 或 `constrained` pattern |
| **L2-ready** | 需要 transform 但無複雜邏輯 | `simple` + `transform` |
| **L2-dispatch** | 根據 operator 路由 | `operatorDispatch` pattern |
| **L2-chain** | 左遞迴鏈式收集 | `chain` pattern |
| **L3-strategy** | 多步驟邏輯可用 liftStrategy 封裝 | `composite` + `liftStrategy` |
| **unmovable** | 深度嵌套邏輯、跨節點狀態 | 保留 hand-written |

### M3. 產生 JSON pattern

根據分類在 `lift-patterns.json` 中新增 pattern。

### M4. 移除 hand-written lifter

### M5. 驗證

```bash
npx tsc --noEmit && npm test
```

如果失敗，還原並報告。

### M6. Round-trip 驗證

對遷移的概念用 Skill tool 調用 `/concept.roundtrip {lang} {concept}` 確保行為等價。

---

## 模式四：Purge Dead（清除死概念）

### P1. 識別死概念

從審計結果中找出 0/6 完備性的概念——在 concepts.json 中註冊但完全沒有實作。

### P2. 評估保留價值

對每個死概念：
- 是否有探索報告描述了它？→ 保留，用 fix 修復
- 是否被其他概念的依賴關係引用？→ 保留，用 fix 修復
- 是否在 topic tree 中？→ 保留，用 fix 修復
- 以上皆否？→ 安全移除

### P3. 移除

從 concepts.json 中移除。如果 topic tree 中有引用，同步移除。

### P4. 驗證

```bash
npx tsc --noEmit && npm test
```

---

## 模式五：Full（完整重構）

依序執行：

```
1. Audit（完整審計）     → 產出審計報告（含 i18n 標籤風格）
2. Fix all（修復全部）   → 修復所有四路缺口
3. Dedup（去重）         → 清除確認等價的雙重註冊
4. Migrate all（遷移）   → 遷移所有 L1/L2-ready 概念
5. Render-fix（渲染修復）→ 修復渲染一致性
6. i18n-fix（標籤修復）  → 修復 i18n 標籤風格不一致問題
7. Purge dead（清除死概念）→ 移除無法修復的死概念
8. 最終驗證              → npx tsc --noEmit && npm test
```

每步之間確認測試通過。如果任何步驟失敗，停止並報告。

---

## 準則

- **絕不破壞現有測試** — 每次修改後必須通過全部測試
- **一次一個概念** — 每個修復/遷移獨立驗證，不批量修改後才測試
- **保守判斷** — 不確定遷移是否安全時保留 hand-written；不確定概念是否該刪時保留
- **宣告式優先** — 目標是讓盡可能多的概念用 JSON 描述（P3 §2.3）
- **信心等級合規** — 每次修復都要設定正確的信心等級（P1 §2.1）
- **四路完備為底線** — 修復後的概念必須 6/6 完備，否則標記為阻擋
- **保留 fallback 價值** — 如果 hand-written 作為安全網有意義，標記 `FALLBACK` 而非移除
- **修復優先於清除** — 能修復的概念不刪，只有完全無價值且無法修復的才 purge

## 完成標記（強制）

此 skill 完成後，**必須**輸出以下格式的完成標記：

```
🏁 SKILL_COMPLETE: concept-refactor | {lang} | {mode} | 修復：{N} | 完備率：{before}% → {after}% | 信心合規：{PASS/FAIL}
```

如果未輸出此標記，表示 skill 未正確完成。
