---
name: concept-roundtrip
description: >
  對特定程式透過 Semorphe 管線執行目標性 round-trip 測試。
  驗證：原始碼 → lift → SemanticTree → generate → 原始碼 → 執行 → 比較 stdout。
  用於驗證特定概念、除錯已知失敗或回歸測試。支援任何語言。
user-invocable: true
---

> **語言指示**：所有輸出文件（報告、摘要、註解）必須使用**當前對話的語言**撰寫。下方模板僅為結構參考，實際用語應配合使用者的語言設定。

# 概念 Round-Trip 測試

## 使用者輸入

```text
$ARGUMENTS
```

參數可以是：
- 一段程式碼片段（內嵌或檔案路徑），語言從副檔名或語法推斷
- `{lang} {concept_name}` 格式（例如 `cpp if`、`python while_loop`）
- `{lang} {difficulty}` 格式（例如 `cpp easy`、`python hard`）
- `{lang} all` 測試該語言所有支援的概念

## 背景

不同於 `/concept.fuzz`（使用資訊隔離的代理進行探索），此 skill 執行**目標性的、感知實作的** round-trip 測試。你可以完整存取 Semorphe 的原始碼，並應利用這些知識來製作精確的測試案例，涵蓋特定的程式碼路徑。

## 前置作業

閱讀以下檔案以理解目前的管線：

- `src/core/types.ts` — SemanticNode、ConceptId、所有型別定義
- `src/languages/{lang}/core/blocks.json` 和 `src/languages/{lang}/std/*/blocks.json` — 所有 block spec JSON 檔案（了解支援的概念）
- `src/languages/{lang}/core/generators/` — 程式碼產生器（了解輸出格式）
- `src/languages/{lang}/core/lifters/` — 提升器（了解輸入處理）
- `src/core/projection/code-generator.ts` — 主要的產生入口點
- `src/core/lift/pattern-lifter.ts` — 主要的提升入口點

## 工作流程

### 步驟一：決定測試範圍

根據 `$ARGUMENTS`，決定語言和要測試的程式：

**如果是程式碼片段或檔案路徑：**
- 直接使用提供的程式碼
- 從副檔名（`.cpp`、`.py`、`.java`、`.js`）或語法推斷語言

**如果是概念名稱：**
- 產生 3-5 個代表性程式來練習該概念
- 包含該概念特有的邊界案例

**如果是難度等級：**
- 產生涵蓋對應 Topic 層級樹深度所有概念的程式
- easy：Topic 層級樹根節點的概念（如 var_declare、arithmetic、if、while_loop、print）
- medium：第一層分支的概念（如 func_def、func_call、count_loop、break、continue）
- hard：第二層以上分支的概念（如 array_declare、array_access 及語言特定的進階概念）
- 使用 `getVisibleConcepts(topic, enabledBranches)` 取得對應分支的可見概念集

**如果是 `all`：**
- 為每個支援的概念產生一個典範程式
- 再產生 3 個混合多個概念的組合程式

### 步驟二：執行原始程式

對每個測試程式，使用對應語言的工具鏈編譯/執行：

```bash
mkdir -p /tmp/semorphe-roundtrip/
# 寫入檔案、編譯（如需要）、執行、記錄 stdout
timeout 5 {run_command} > /tmp/semorphe-roundtrip/test_{id}_expected.txt 2>&1
```

如果執行失敗，報告錯誤並跳過（測試程式本身無效）。

### 步驟三：執行 Semorphe 管線

建立 Node.js runner 腳本來執行 lift→generate round-trip。先閱讀專案既有的測試基礎設施，了解如何初始化該語言的管線：

```bash
# 檢查既有的測試模式
grep -r "Lifter\|PatternLifter\|register" tests/ --include="*.ts" -l
```

然後建立並執行 round-trip 腳本：

```bash
npx tsx /tmp/semorphe-roundtrip/runner.ts
```

### 步驟四：執行產生的程式碼

對每個產生的檔案，用同樣的語言工具鏈編譯/執行，記錄 stdout。

### 步驟五：比較結果

對每個測試，執行三個層級的比較：

**層級一 — Stdout 等價性**（最重要）：
```bash
diff /tmp/semorphe-roundtrip/test_{id}_expected.txt /tmp/semorphe-roundtrip/test_{id}_actual.txt
```

**層級二 — 語義樹完整性（P1 投影定理）**：
- 將 SemanticTree dump 為 JSON
- 檢查沒有節點有 `confidence: 'raw_code'`（除非該概念確實不支援）
- 檢查概念名稱是否符合預期
- **二次 round-trip 驗證**：對產生的程式碼再次 lift，比較兩次語義樹是否結構等價（節點類型、屬性、子節點結構相同），驗證 P1 可逆性
- 統計 `raw_code`/`unresolved` 節點佔總節點的比例

**層級三 — 多分支鷹架行為（P4 漸進式揭露）**：
- 對同一個語義樹，使用不同的 `enabledBranches` 集合產生程式碼（例如只啟用根節點、啟用到第一層、啟用全部分支）
- 驗證各分支組合的輸出都能編譯/執行
- 驗證未啟用分支的概念不會出現在輸出中（鷹架正確隱藏）
- 比較各分支組合的 stdout 輸出（應該相同或等價）

**層級四 — 層級轉換穩定性（§2.4）**：
- 驗證 L₁ 可見概念在 L₂ 的呈現不變——只增不改

**層級五 — 積木-程式碼一致性（§1.4 Sc4）**：
- 積木行為和生成的程式碼一致——BlockSpec message 與 generator 輸出語義一致

**層級六 — 程式碼結構比較**（僅供參考）：
- 比較原始和產生的程式碼結構（不是精確文字 — 格式可能不同）
- 記錄任何顯著的結構差異

### 步驟六：分類並報告

分類每個測試結果：

| 結果 | 符號 | 意義 |
|------|------|------|
| PASS | ✅ | Stdout 匹配，乾淨的語義樹 |
| STDOUT_DIFF | ❌ | Stdout 不同 — 語義 bug |
| COMPILE_FAIL | ❌ | 產生的程式碼無法執行 — generator bug |
| LIFT_FAIL | ⚠️ | Lifter 當掉或產生 null 樹 |
| DEGRADED | 🟡 | 程式碼被降級為 raw_code — 覆蓋缺口 |
| SCAFFOLD_LEAK | ❌ | 低層級輸出包含高層級概念語法 — P4 違規 |
| ROUNDTRIP_DRIFT | ❌ | 二次 round-trip 語義樹結構不同 — P1 違規 |
| TIMEOUT | ❌ | 產生的程式碼掛住 — 可能的無窮迴圈 |
| STRUCTURE_DIFF | 🔵 | Stdout 匹配但程式碼結構顯著不同 |

### 步驟七：輸出報告

將報告儲存到 `tests/reports/roundtrip-{lang}-{concept|difficulty}-{timestamp}.md`（目錄不存在時自行建立），同時印出摘要表格：

```
## Round-Trip 測試結果（{language}）

| # | 程式 | 概念 | 結果 | 細節 |
|---|------|------|------|------|
| 1 | basic_if | if, compare, print | ✅ PASS | |
| 2 | nested_loop | while_loop, count_loop | ❌ STDOUT_DIFF | 缺少遞增 |

摘要：8/10 PASS、1 STDOUT_DIFF、1 LIFT_FAIL
```

對每個失敗，包含：原始程式碼、語義樹、產生的程式碼、diff、根本原因假設。

### 步驟八：產生永久測試（必要）

**所有測試案例都必須留存為可重複執行的 Vitest 測試檔**，不可用完即丟。

1. **PASS 的測試**：在 `tests/integration/` 建立測試檔（檔名 `roundtrip-{lang}-{concept}.test.ts`），包含所有 PASS 的測試程式作為 round-trip 回歸測試。每個測試驗證：lift → generate → 再 lift 的語義樹結構等價性。
2. **失敗的測試（❌）**：同樣建立測試檔（檔名加 `roundtrip-` 前綴），但用 `it.skip` 或 `it.todo` 標記，附上失敗原因註解，待修復後啟用。
3. **Runner 腳本不可作為驗證手段**：`/tmp/` 下的臨時 runner 僅用於探索性執行。最終驗證結果必須轉化為 Vitest 測試案例，確保 CI 可重複捕捉回歸。
4. 如果目標概念已有測試檔（如 `tests/integration/cmath-roundtrip.test.ts`），將新案例**追加**到既有檔案中，避免重複建檔。

執行 `npm test` 確認新測試通過。

## 快速模式

快速迭代時，對單一片段執行最小 round-trip：

```
/concept.roundtrip `int main() { int x = 5; if (x > 3) { cout << "yes"; } return 0; }`
/concept.roundtrip `print("hello" if True else "bye")`
```

跳過報告產生，直接顯示：PASS/FAIL + 如果失敗則顯示 diff。

## 設定

- 每個程式逾時：5 秒
- 暫存目錄：`/tmp/semorphe-roundtrip/`
- 成功執行後清理暫存檔（失敗時保留以供除錯）
