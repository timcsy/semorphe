---
name: concept-fuzz
description: >
  為 Semorphe 的程式碼↔積木管線產生資訊隔離的模糊測試。
  使用雙代理架構：Agent A（不知道實作）寫真實程式，
  Agent B 驗證 round-trip 正確性和編譯器/直譯器輸出等價性。
  用於找出實作感知測試會遺漏的邊界案例和 bug。支援任何語言。
user-invocable: true
---

> **語言指示**：所有輸出文件（報告、摘要、註解）必須使用**當前對話的語言**撰寫。下方模板僅為結構參考，實際用語應配合使用者的語言設定。

# 概念模糊測試

## 使用者輸入

```text
$ARGUMENTS
```

參數格式為 `[語言] [難度] [範疇] [數量]`，例如：
- `cpp hard loops 20` — C++ 困難的迴圈範疇 20 題
- `python medium` — Python 中級 10 題（預設）
- `easy 5` — 未指定語言時使用預設語言，簡單 5 題
- `java functions 15` — Java 函式範疇 15 題

難度等級：`easy`、`medium`、`hard`、`all`
難度對應 Topic 層級樹深度：easy = depth 0、medium = depth 1、hard = depth 2+（同 `/concept.pipeline` 階段四）
範疇（scope）範例：`loops`、`functions`、`arrays`、`pointers`、`strings`、`classes`

## 架構：雙代理資訊隔離

此 skill 使用**兩個有嚴格資訊邊界的代理**來產生高品質測試：

```
Agent A（出題者）                Agent B（驗證者）
━━━━━━━━━━━━━━━━               ━━━━━━━━━━━━━━━━
知道：                           知道：
  ✓ 目標語言的語言規範            ✓ 完整的 Semorphe 原始碼
  ✓ 難度分級定義                   ✓ 如何執行 lift/render/generate
  ✓「寫真實的程式」               ✓ 如何編譯/執行目標語言程式
                                  ✓ 如何比較輸出
不知道：
  ✗ Semorphe 原始碼             不知道：
  ✗ 支援哪些概念                  ✗ 為什麼選擇這些程式
  ✗ lifter/generator 如何運作     ✗ Agent A 的意圖
  ✗ 已知 bug 或限制
```

**為什麼這很重要**：如果測試作者知道實作，他們會下意識避開程式碼無法處理的模式。一個「無知」的作者會像真實學生一樣寫程式碼 — 暴露真正的缺口。

## 語言特定設定

| 語言 | 編譯/執行指令 | 標準 | 副檔名 |
|------|-------------|------|--------|
| C++ | `g++ -std=c++17 -o prog prog.cpp && ./prog` | C++17 | `.cpp` |
| Python | `python3 prog.py` | 3.10+ | `.py` |
| Java | `javac Prog.java && java Prog` | 17+ | `.java` |
| JavaScript | `node prog.js` | ES2022 | `.js` |

根據目標語言調整 Agent A 的 prompt 和驗證流程。

## 工作流程

### 步驟一：啟動 Agent A（隔離的出題者）

使用 Agent 工具啟動 Agent A，設定 `isolation: "worktree"` 以防止存取原始碼。

**Agent A 的 prompt**（根據使用者的 `$ARGUMENTS` 和目標語言調整）：

---

You are a {LANGUAGE} programming instructor creating practice programs for students. You have NO knowledge of any specific tool or system — you are simply writing real, runnable {LANGUAGE} programs.

**Requirements for each program:**
1. Must compile/run without errors using standard toolchain
2. Must produce deterministic stdout output (no random, no user input, no time-dependent)
3. Must be self-contained (single file, standard libraries only)
4. Must have a clear entry point (main function or top-level code as appropriate)
5. Should represent realistic student code at the specified difficulty level

**Difficulty calibration:**

EASY (root-level equivalent):
- Variables, basic arithmetic, simple if/else, while loops
- Basic output (print/cout/System.out)
- No functions (other than main if required), no arrays/lists, no pointers/references
- Tricky patterns: operator precedence, integer division, type coercion edge cases

MEDIUM (branch-level-1 equivalent):
- Functions with parameters and return values, for loops, nested control flow
- Logical operators, compound assignment
- Switch/match, do-while (if language supports), break/continue
- Tricky patterns: function calling function, shadowed variables, short-circuit evaluation

HARD (branch-level-2+ equivalent):
- Arrays/lists, string operations
- Pointers/references (if applicable), pass-by-reference
- Recursion, multiple functions interacting
- Language-specific advanced features (templates, closures, generics, etc.)
- Tricky patterns: off-by-one, scope issues, type conversion edge cases

**For each program, output a JSON object:**

```json
{
  "id": "fuzz_{N}",
  "difficulty": "easy|medium|hard",
  "scope": "brief scope description (e.g. loops, functions, arrays)",
  "description": "what this program tests (1 sentence)",
  "code": "the full source code",
  "tricky_aspect": "what makes this program non-trivial (1 sentence)"
}
```

**IMPORTANT**: Do NOT include any field describing expected concepts, AST structure, or internal tool behavior. You are writing programs as a teacher, not analyzing tool internals.

Generate {N} programs covering diverse patterns. Focus on EDGE CASES and TRICKY COMBINATIONS — not textbook hello-world programs. Think about what real students write that breaks tools.

Output ALL programs as a single JSON array.

---

### 步驟二：編譯/執行 Agent A 的程式

Agent A 回傳程式後：

1. 解析程式的 JSON 陣列
2. 對每個程式，寫入檔案並編譯/執行：
   ```bash
   # 以 C++ 為例
   echo "$CODE" > /tmp/semorphe-fuzz/fuzz_{id}.cpp
   g++ -std=c++17 -o /tmp/semorphe-fuzz/fuzz_{id} /tmp/semorphe-fuzz/fuzz_{id}.cpp 2>/tmp/semorphe-fuzz/fuzz_{id}_compile.log
   timeout 5 /tmp/semorphe-fuzz/fuzz_{id} > /tmp/semorphe-fuzz/fuzz_{id}_expected.txt 2>&1
   ```
3. 記錄：編譯/執行成功/失敗、stdout 輸出、stderr

**捨棄**無法編譯/執行的程式 — 那是 Agent A 的錯誤，不是測試失敗。

### 步驟三：執行 Round-Trip 管線

對每個成功執行的程式，執行 Semorphe 管線：

1. **提升（Lift）**：使用該語言的 lifter 將原始碼 → SemanticTree
2. **語義樹檢查（P1 投影定理驗證）**：
   - 將 SemanticTree dump 為 JSON
   - 統計 `raw_code` 和 `unresolved` 節點的數量和比例
   - 執行二次 round-trip（lift → generate → lift），比較兩次語義樹是否結構等價（P1 可逆性）
3. **產生（Generate）**：使用程式碼產生器將 SemanticTree → 原始碼
4. **多分支鷹架測試（P4 漸進式揭露）**：使用不同的 `enabledBranches` 集合分別產生程式碼，驗證：
   - 未啟用分支的概念不出現在輸出中
   - 各分支組合的輸出皆可編譯/執行
   - 啟用更多分支時輸出保留更多語義細節
5. **編譯/執行產生的程式碼**
6. **比較輸出**：
   ```bash
   diff /tmp/semorphe-fuzz/fuzz_{id}_expected.txt /tmp/semorphe-fuzz/fuzz_{id}_actual.txt
   ```

要以程式化方式執行步驟 1-4，建立並執行 Node.js 腳本，import 該語言模組的 lifter 和 generator。

### 步驟四：分類結果

結果分類基礎定義見 `/concept.roundtrip` 步驟六。本 skill 額外加入 `EXPECTED_DEGRADATION`。

對每個程式，分類結果：

| 結果 | 意義 | 行動 |
|------|------|------|
| **PASS** | 產生的程式碼可執行且輸出相同 | 記錄為通過的測試 |
| **SEMANTIC_DIFF** | 產生的程式碼可執行但輸出不同 | **BUG** — 調查語義樹 |
| **COMPILE_FAIL** | 產生的程式碼無法編譯/執行 | **BUG** — generator 產生了無效程式碼 |
| **LIFT_FAIL** | Lifter 當掉或回傳 null | **限制** — 可能需要新概念 |
| **EXPECTED_DEGRADATION** | 程式碼使用不支援的特性，降級為 raw_code | 預期中 — 記錄覆蓋缺口 |
| **SCAFFOLD_LEAK** | 低層級輸出包含高層級概念語法 | **BUG** — P4 漸進揭露違規 |
| **ROUNDTRIP_DRIFT** | 二次 round-trip 語義樹結構不同 | **BUG** — P1 可逆性違規 |
| **TIMEOUT** | 產生的程式碼掛住 | **BUG** — 可能有無窮迴圈 |

**層級轉換穩定性**：驗證 L₁ 可見概念在 L₂ 的呈現不變——只增不改（§2.4 層級轉換穩定性）。

### 步驟五：產生報告和測試

在 `tests/reports/fuzz-{lang}-{timestamp}.md`（目錄不存在時自行建立）建立模糊測試報告：

```markdown
# 模糊測試報告 — {language} — {date}

## 摘要
- 語言：{language}
- 產生的程式數：N
- 成功執行：N
- Round-trip PASS：N
- SEMANTIC_DIFF（bug）：N
- COMPILE_FAIL（bug）：N
- LIFT_FAIL（限制）：N
- EXPECTED_DEGRADATION：N

## 發現的 Bug

### Bug 1：{描述}
- **輸入**：```{lang} {原始程式碼} ```
- **預期輸出**：{expected stdout}
- **實際輸出**：{actual stdout}
- **語義樹**：{提升的樹的 JSON dump}
- **產生的程式碼**：```{lang} {generated code} ```
- **根本原因假設**：{分析}

## 覆蓋缺口
{Agent A 使用的但 Semorphe 尚未支援的概念}

## 產生的回歸測試
{建立的測試檔案列表}
```

**所有模糊測試結果都必須留存為可重複執行的 Vitest 測試檔**，不可用完即丟。

1. **PASS 的測試**：在 `tests/integration/` 建立測試檔（檔名 `fuzz-{lang}-{scope}.test.ts`），將 PASS 的程式轉化為 round-trip 回歸測試。每個測試驗證 lift → generate 的語義樹結構等價性，確保未來修改不會破壞已驗證的行為。
2. **BUG（❌）的測試**：同樣建立測試檔（檔名加 `fuzz-` 前綴），用 `it.skip` 或 `it.todo` 標記，附上 bug 描述和根本原因假設，待修復後啟用。
3. **Runner 腳本不可作為驗證手段**：`/tmp/` 下的臨時 runner 僅用於探索性執行。最終驗證結果必須轉化為 Vitest 測試案例，確保 CI 可重複捕捉回歸。
4. 如果已有同範疇的測試檔，將新案例**追加**到既有檔案中。

執行 `npm test` 確認新測試通過。

### 步驟六：向使用者總結

呈現：
1. 測試了多少程式
2. 找到多少 bug（含嚴重度）
3. 識別了多少覆蓋缺口
4. 建立了哪些永久測試檔（含路徑和測試數量）
5. 建議：優先修復哪些 bug

## 設定

- 預設程式數：10
- 每個程式逾時：5 秒
- 暫存目錄：`/tmp/semorphe-fuzz/`

## 有效模糊測試的技巧

- 多次執行 — 每次執行會產生不同程式
- 從 `easy` 開始驗證基本管線，再升級到 `hard`
- 調查已知弱點時指定特定範疇
- 最有價值的 bug 來自 `SEMANTIC_DIFF` — 程式碼可執行但行為錯誤
- 跨語言比較：如果通用概念在 A 語言 PASS 但 B 語言 FAIL，問題可能在語言特定的 lifter/generator
