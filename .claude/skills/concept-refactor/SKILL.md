---
name: concept-refactor
description: >
  審計並重構 Semorphe 已有的語言概念實作。
  偵測雙重註冊、遷移 hand-written lifter 至 JSON pattern、
  統一 render strategy、驗證一致性。
  用於清理技術債和提升概念實作的宣告式比例。支援任何語言。
user-invocable: true
---

> **語言指示**：所有輸出文件（報告、摘要、註解）必須使用**當前對話的語言**撰寫。下方模板僅為結構參考，實際用語應配合使用者的語言設定。

# 概念重構

## 使用者輸入

```text
$ARGUMENTS
```

參數格式：

- `{lang} audit` — 完整審計，不做修改（預設）
- `{lang} migrate {concept}` — 將指定概念的 hand-written lifter 遷移至 JSON pattern
- `{lang} migrate all` — 遷移所有可遷移的概念
- `{lang} dedup` — 清除雙重註冊（hand-written + JSON 重疊）
- `{lang} render-audit` — 審計 render strategy 與 auto-derive 的一致性
- `{lang} full` — 依序執行 audit → dedup → migrate all → render-audit

## 背景

隨著概念數量增長，實作可能出現三類技術債：

1. **雙重註冊**：同一 AST 節點類型同時有 hand-written lifter 和 JSON pattern，行為取決於隱含的優先權順序，而非明確意圖
2. **宣告式不足**：可以用 JSON pattern（Layer 1/2）表達的邏輯仍寫在 TypeScript 中，增加維護成本
3. **Render 不一致**：某些概念用 `renderMapping.strategy`，某些用 auto-derive，但選擇缺乏明確標準

此 skill 系統化地處理這三類問題。

## 前置作業

閱讀以下檔案以理解目前實作：

- `src/core/lift/lifter.ts` — 優先權鏈：PatternLifter first → hand-written fallback
- `src/core/lift/pattern-lifter.ts` — 7 種 pattern type 及其優先權計算
- `src/languages/{lang}/lift-patterns.json` — JSON pattern 定義
- `src/languages/{lang}/core/lifters/` — hand-written lifter 目錄
- `src/languages/{lang}/core/lifters/strategies.ts` — LiftStrategy 註冊
- `src/languages/{lang}/renderers/strategies.ts` — RenderStrategy 註冊
- `src/languages/{lang}/core/blocks.json` — BlockSpec（含 astPattern）
- `src/blocks/projections/blocks/universal-blocks.json` — 通用 BlockSpec（含 renderMapping）

## 工作流程

### 模式一：Audit（審計）

#### 步驟一：盤點所有概念來源

掃描三個註冊來源，建立概念矩陣：

| 來源 | 位置 | 優先權 |
|------|------|--------|
| **Hand-written** | `lifter.register(nodeType, fn)` 呼叫 | 最低（PatternLifter 優先） |
| **JSON pattern** | `lift-patterns.json` 條目 | 中（由 patternType + priority 決定） |
| **BlockSpec astPattern** | `blocks.json` 中的 `astPattern` 欄位 | 最低（auto-derive，-5 penalty） |

建立 `{nodeType → [sources]}` 映射表。

#### 步驟二：偵測雙重註冊

對每個 AST nodeType，檢查是否在多個來源中註冊：

- **Hand-written + JSON**：最常見的雙重註冊。PatternLifter 優先執行，hand-written 永遠不會被觸發（除非 pattern 回傳 null）。標記為 `SHADOW`（hand-written 被 JSON 遮蔽）或 `FALLBACK`（hand-written 作為 JSON 的安全網）。
- **JSON + BlockSpec**：JSON 有明確 priority，BlockSpec 被壓過。通常無害但冗餘。
- **三方重疊**：最需要清理。

#### 步驟三：分類可遷移性

對每個 hand-written lifter，評估是否可遷移至 JSON pattern：

| 遷移性 | 條件 | 目標 |
|--------|------|------|
| **L1-ready** | 純欄位映射，無條件分支 | `simple` 或 `constrained` pattern |
| **L2-ready** | 需要 transform（如 stripQuotes）但無複雜邏輯 | `simple` + `transform` |
| **L2-dispatch** | 根據 operator 路由到不同概念 | `operatorDispatch` pattern |
| **L2-chain** | 左遞迴鏈式收集（如 cout <<） | `chain` pattern |
| **L3-strategy** | 需要多步驟邏輯但可用 liftStrategy 封裝 | `composite` + `liftStrategy` |
| **unmovable** | 深度嵌套邏輯、跨節點狀態、副作用 | 保留 hand-written |

#### 步驟四：Render strategy 審計

對每個概念，檢查 renderMapping：

- **有 strategy 但可 auto-derive**：如果 BlockSpec 的 blockDef 結構足以描述映射，strategy 是冗餘的
- **無 strategy 但 auto-derive 不足**：可能導致渲染錯誤
- **Strategy 與 generator 語義不一致**：BlockSpec message 描述的行為與 generator 輸出不同（違反 §1.4 Sc4）

#### 步驟五：輸出審計報告

```markdown
## 概念重構審計報告（{language}）

### 概念矩陣

| AST NodeType | Hand-Written | JSON Pattern | BlockSpec | 狀態 |
|---|---|---|---|---|
| number_literal | ✓ expressions.ts:12 | ✓ cpp_number_literal | ✓ u_number | SHADOW |
| binary_expression | ✓ expressions.ts:30 | ✓ dispatch+chain | - | FALLBACK |
| if_statement | ✓ statements.ts:18 | ✓ cpp_if_statement | - | SHADOW |
| ...

### 雙重註冊（需清理）

| NodeType | 問題 | 建議 |
|---|---|---|
| number_literal | Hand-written 被 JSON 遮蔽，永遠不觸發 | 移除 hand-written |
| ...

### 可遷移概念

| 概念 | 目前位置 | 遷移目標 | 難度 |
|---|---|---|---|
| if_statement | statements.ts | JSON simple + liftBody | L1-ready |
| while_statement | statements.ts | JSON simple + liftBody | L1-ready |
| for_statement | statements.ts | 保留（複雜分支） | unmovable |
| ...

### Render 審計

| 概念 | Strategy | 可 Auto-Derive? | 問題 |
|---|---|---|---|
| print | cpp:renderPrint | 否（動態 itemCount） | OK |
| var_ref | 無 | 是 | OK |
| ...

### 統計

- 概念總數：{N}
- Hand-written only：{N}（{%}）
- JSON only：{N}（{%}）
- 雙重註冊：{N}（建議清理）
- 可遷移至 JSON：{N}
- 宣告式比例（目標 ≥ 80%）：{%}
```

將報告儲存到 `tests/reports/refactor-audit-{lang}-{timestamp}.md`。

---

### 模式二：Migrate（遷移）

#### 步驟一：建立 baseline

```bash
npm test
```

所有測試必須通過。記錄測試數量作為 baseline。

#### 步驟二：讀取目標 lifter

讀取 hand-written lifter 的完整實作，理解：
- 輸入：AST nodeType 和 childForFieldName 存取
- 條件分支：哪些條件決定產生哪種 SemanticNode
- 輸出：createNode 的 concept、properties、children

#### 步驟三：判斷可遷移性

按照 Audit 步驟三的分類標準判斷。如果是 `unmovable`，報告原因並跳過。

#### 步驟四：產生 JSON pattern

根據遷移性分類，在 `lift-patterns.json` 中新增對應 pattern：

**L1-ready（simple/constrained）：**
```json
{
  "id": "cpp_{concept}",
  "astNodeType": "{nodeType}",
  "concept": { "conceptId": "{concept}" },
  "fieldMappings": [
    { "semantic": "{prop}", "ast": "{field}", "extract": "lift|text|liftBody" }
  ]
}
```

**L2-dispatch（operatorDispatch）：**
```json
{
  "id": "cpp_{concept}_dispatch",
  "astNodeType": "{nodeType}",
  "patternType": "operatorDispatch",
  "operatorDispatch": {
    "operatorField": "$operator",
    "routes": { "+": "arithmetic", ... },
    "fieldMappings": [...]
  },
  "priority": 5
}
```

**L3-strategy（composite + liftStrategy）：**
- 在 `strategies.ts` 中保留核心邏輯為 liftStrategy 函式
- 在 `lift-patterns.json` 中建立 pattern 進入點
- 確保 constraints gate 在 strategy 前執行

#### 步驟五：移除 hand-written lifter

從 `expressions.ts`、`statements.ts` 或 `declarations.ts` 中移除對應的 `lifter.register()` 呼叫。如果整個檔案為空，移除該檔案並更新 `index.ts`。

#### 步驟六：驗證

```bash
npx tsc --noEmit && npm test
```

如果測試失敗：
- 比對失敗的測試與修改的概念
- 還原修改，報告遷移失敗原因
- 嘗試降級為 L3-strategy（保留 TypeScript 邏輯但用 JSON 進入點）

#### 步驟七：Round-trip 驗證

對遷移的概念執行 round-trip 測試（同 `/concept.roundtrip {lang} {concept}`），確保行為等價。

#### 步驟八：報告

```markdown
## 遷移報告：{concept}（{language}）

### 變更
- 新增 JSON pattern：`lift-patterns.json` — {pattern_id}
- 移除 hand-written：`{file}.ts` — lifter.register('{nodeType}', ...)

### 驗證
- TypeScript：✅
- 單元測試：✅ {N} passed
- Round-trip：✅ {N}/{M} passed

### 遷移前後對比
- Pattern type：hand-written → {patternType}
- Layer：imperative → L{1|2|3}
- 行數：{before} → {after}（減少 {N} 行 TypeScript）
```

---

### 模式三：Dedup（去重）

#### 步驟一：找出所有 SHADOW 條目

從 Audit 結果中取出所有 `SHADOW` 狀態的概念——hand-written lifter 被 JSON pattern 遮蔽，永遠不觸發。

#### 步驟二：驗證行為等價

對每個 SHADOW 概念，比較 JSON pattern 和 hand-written lifter 的輸出：

1. 收集該 nodeType 的 5-10 個代表性 AST 片段
2. 分別用 JSON pattern 和 hand-written lifter 處理
3. 比較產生的 SemanticNode 結構

如果行為等價 → 安全移除 hand-written。
如果行為不同 → 標記為 `CONFLICT`，需要人工決定保留哪個。

#### 步驟三：移除冗餘註冊

移除確認等價的 hand-written lifter。

#### 步驟四：驗證

```bash
npx tsc --noEmit && npm test
```

---

### 模式四：Render Audit（渲染審計）

#### 步驟一：掃描所有 renderMapping

列出所有 BlockSpec 的 renderMapping 設定：
- `strategy` 指定的策略名稱
- 無 strategy 的使用 auto-derive

#### 步驟二：偵測可簡化的 strategy

對每個有 strategy 的概念，檢查是否可用 auto-derive 替代：
- 如果 BlockSpec 的 `blockDef.args` 欄位與語義屬性是 1:1 映射 → strategy 可能冗餘
- 如果 strategy 只做簡單欄位複製 → 可簡化為 auto-derive

#### 步驟三：偵測缺失 strategy

對每個無 strategy 的概念，檢查 auto-derive 是否充分：
- 如果概念有動態 input（extraState 控制的 mutator） → 需要 strategy
- 如果概念有多對一映射（多個語義屬性合併到一個 block field） → 需要 strategy

#### 步驟四：Sc4 一致性

對每個概念，比較 BlockSpec `message` 描述的行為與 generator 輸出的語義：
- message 中的 input 數量是否與 generator 使用的語義子節點數量一致
- 動態 mutator（extraState）的欄位是否與 render strategy 產生的 extraState 結構一致

---

### 模式五：Full（完整重構）

依序執行：

```
1. Audit          → 產出概念矩陣和審計報告
2. Dedup          → 清除確認等價的雙重註冊
3. Migrate all    → 遷移所有 L1/L2-ready 概念
4. Render audit   → 檢查渲染一致性
5. 最終驗證       → npm test + /concept.roundtrip {lang} all
```

每一步之間確認測試通過。如果任何步驟失敗，停止並報告。

---

## 遷移決策樹

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

## 準則

- **絕不破壞現有測試** — 每次修改後必須通過全部測試
- **一次一個概念** — 每個遷移獨立驗證，不批量修改後才測試
- **保守判斷** — 如果不確定遷移是否安全，保留 hand-written
- **宣告式優先** — 目標是讓盡可能多的概念用 JSON 描述（P3 開放擴展 §2.3）
- **Layer 3 是合法選擇** — 複雜邏輯用 liftStrategy 封裝在 JSON 進入點中，兼顧可發現性和靈活性
- **保留 fallback 價值** — 如果 hand-written 作為 JSON pattern 的安全網有意義（如複雜的 binary_expression 處理），標記為 `FALLBACK` 而非移除
