---
name: concept-integrate
description: >
  新 Semorphe 概念的最終整合關卡。執行所有驗證步驟
  （TypeScript 編譯、單元測試、round-trip 測試、模糊測試），
  然後將通過的概念整合到程式碼庫中並完成正確的註冊。
  在 /concept.generate 之後作為最終步驟使用。支援任何語言。
user-invocable: true
---

> **語言指示**：所有輸出文件（報告、摘要、註解）必須使用**當前對話的語言**撰寫。下方模板僅為結構參考，實際用語應配合使用者的語言設定。

## ⛔ 調用要求

此 skill **必須透過 Skill tool 調用**，不可手動替代。當由 `/concept.pipeline` 編排時，pipeline 會使用 Skill tool 調用此 skill。

**前置條件**：此 skill 只能在 concept-discover、concept-generate、concept-roundtrip、concept-fuzz 都已完成後才能調用（除非使用了 `--dry-run` 或 `--skip-fuzz` 旗標）。

**完成時必須輸出完成標記**（見最後一節）。

# 概念整合

## 使用者輸入

```text
$ARGUMENTS
```

參數應為以下其一：
- `{lang} {concept_name}`（例如 `cpp do_while`、`python list_comprehension`）
- 概念探索報告的路徑，以整合其中所有概念
- `{lang} check` — 只執行驗證，不整合
- `{lang} status` — 顯示該語言所有待整合概念的目前狀態
- `status` — 顯示所有語言的概念整合狀態

## 背景

這是新概念正式成為 Semorphe 一部分之前的**最終關卡**。它驗證所有產出物（BlockSpec、generator、lifter、渲染映射、executor、測試）能正確協同運作，然後將一切接入系統。

## 前置檢查清單

在執行整合之前，驗證目標概念的這些檔案是否存在：

- [ ] Block spec JSON 條目在核心 `src/languages/{lang}/core/blocks.json` 或 STD `src/languages/{lang}/std/{module}/blocks.json`
- [ ] 程式碼產生器在 `src/languages/{lang}/core/generators/*.ts`
- [ ] 提升器在 `src/languages/{lang}/core/lifters/*.ts`
- [ ] 渲染映射在 block spec JSON 中（auto-derive 或顯式 renderStrategy 或 dynamicRules）
- [ ] Interpreter executor 在 `src/interpreter/executors/*.ts` 中註冊（可執行概念需實作邏輯，宣告性概念需 noop）
- [ ] 單元測試在 `tests/`（含執行測試）
- [ ] 概念在核心 `src/languages/{lang}/core/concepts.json` 或 STD `src/languages/{lang}/std/{module}/concepts.json` 中註冊

如果是通用概念，額外檢查：
- [ ] `src/core/types.ts` 中的 `UniversalConcept` 型別已更新
- [ ] 所有已支援語言都有對應的 generator 和 lifter

如果缺少任何產出物，報告缺少哪些，並建議先執行 `/concept.generate` 或 `/concept.refactor fix`。

## 工作流程

### 步驟零：四路完備性自動掃描（強制阻擋）

**這是整合的第一道關卡，不可跳過。**

對目標概念執行自動化六路掃描（P2 §2.2 四路完備性 + Execute + Test）：

```bash
# 用 grep 搜尋概念在各路徑中的存在性
grep -rn "'{concept_id}'" src/languages/{lang}/ src/interpreter/executors/ tests/ --include="*.ts" --include="*.json"
```

逐一確認：

| # | 路徑 | 搜尋目標 | 存在？ |
|---|------|---------|-------|
| 1 | Lift | lifter `register()` 或 `lift-patterns.json` 條目 | |
| 2 | Render | blocks.json 中的 BlockSpec + `renderMapping` | |
| 3 | Extract | PatternExtractor auto-derive 可反向提取（blockDef args + concept children）；動態概念需有 `dynamicRules`；expression counterpart 須有完整 blockDef args0 | |
| 4 | Generate | generator `generators.set()` | |
| 5 | Execute | executor `register()` | |
| 6 | Test | 測試檔含 lift/generate/round-trip 測試 | |

**任何路徑缺失即為阻擋問題**：
- 報告缺失路徑清單
- 建議執行 `/concept.generate {lang} {concept}` 補全，或 `/concept.refactor {lang} fix {concept}` 修復
- **不可繼續後續步驟**

### 步驟一：TypeScript 編譯檢查

```bash
npx tsc --noEmit
```

這會捕捉：缺少的 import、型別不匹配、不正確的欄位型別。

如果失敗，報告錯誤並停止。

### 步驟二：執行完整測試套件

```bash
npm test
```

所有現有測試必須通過。新概念不能破壞任何東西。

如果測試失敗：
- 如果失敗在新概念的測試中 → 報告並建議修復
- 如果失敗在現有測試中 → **停止** — 新概念破壞了某些東西

### 步驟三：執行目標性 Round-Trip 測試

對正在整合的概念，產生 5-10 個代表性程式並執行 round-trip 驗證（同 `/concept.roundtrip` 流程）。

**概念身分驗證（必要）**：除了驗證 roundtrip 穩定性和 stdout 等價性之外，**每個測試都必須斷言語義樹中使用了正確的 conceptId**。這防止 lifter 退化到通用概念（如 `var_declare`）卻碰巧生成正確程式碼的假陽性。範例：
```typescript
const ptrs = findConcepts(sem!, 'cpp_pointer_declare')
expect(ptrs.length).toBeGreaterThan(0)
```

如果語義樹中存在錯誤的概念，即使 roundtrip 程式碼正確，也應標記為 **WRONG_CONCEPT** 並視為 BUG 修復。

所有程式必須 PASS 或 DEGRADED。

### 步驟四：跨概念相容性

測試新概念與現有概念正確組合：

1. **巢狀測試**：將新概念放入現有結構中（if 主體、迴圈主體、函式主體）
2. **並列測試**：將新概念放在現有語句旁邊
3. **表達式上下文測試**：如果概念產生表達式，在算術、比較、函式引數中使用
4. **風格變體測試**：執行不同風格的產生（如 C++ 的 cout/printf、Python 的 f-string/format）

產生 3-5 個組合程式。

### 步驟五：積木渲染驗證

驗證積木在 Blockly 中正確渲染：

1. 以程式化方式為概念建立 SemanticNode
2. 執行 `renderToBlocklyState()`
3. 驗證 Blockly 狀態 JSON 有正確的積木類型、欄位、輸入和連接
4. 如果概念有 `expressionCounterpart`，驗證兩種形式都能渲染

### 步驟五之二：信心等級合規審計（P1 §2.1）

掃描該概念的 lifter 實作，驗證信心等級設定是否符合第一性原理：

1. **Composite pattern 驗證**：如果概念使用 composite pattern（`pattern-lifter.ts`），確認匹配後有語義驗證步驟，不可在未驗證的情況下設 `confidence: 'high'`
2. **一對多映射檢查**：如果概念的 AST nodeType 可映射到多個不同概念（如 `call_expression`），確認 lifter 在歧義情境下使用 `confidence: 'warning'` 而非 `'high'`
3. **降級路徑存在性**：確認 lifter 在無法識別 AST 結構時有 `raw_code` 降級路徑，而非靜默丟棄節點
4. **`warning` 使用頻率**：如果概念的 lifter 從未設定 `warning`，但存在歧義情境，標記為**建議修復**

輸出信心等級審計結果：
```
信心等級審計：
- high 使用：{N} 處（{是否合規}）
- warning 使用：{N} 處（{是否合規}）
- inferred 使用：{N} 處
- raw_code 降級：{有/無}
- composite 語義驗證：{有/無}
```

如果發現 composite pattern 無語義驗證且設為 `high`，標記為**警告**（不阻擋整合，但記錄在已知限制中）。

### 步驟五之三：i18n 標籤一致性審計（強制）

掃描新概念的 BlockSpec 和 i18n 條目，驗證標籤風格是否符合規範且與同類概念一致。

**審計步驟**：

1. **讀取新概念的 BlockSpec**——取得 `message0` 中引用的所有 `%{BKY_...}` key
2. **讀取 i18n 檔案**——從 `src/i18n/zh-TW/blocks.json` 和 `src/i18n/en/blocks.json` 取得翻譯文字
3. **讀取同 category 的所有 BlockSpec**——找出同分類的現有積木標籤作為參照
4. **逐條檢查**：

| 檢查項 | 通過條件 | 失敗時 |
|--------|---------|--------|
| 中文為描述式 | 包含動詞，不含括號或原始語法 | ⚠️ 建議修改 |
| 英文首字母大寫 | 以大寫字母開頭的動詞短語 | ⚠️ 建議修改 |
| 函式/方法名未當標籤 | 標籤不含 `.method()` 或 `func()` 語法 | ⚠️ 建議修改 |
| 語言關鍵字未當標籤 | 標籤不以原始語言關鍵字開頭（如 C++ 的 `const`、`virtual`、`auto`；Python 的 `def`、`class`；Java 的 `abstract`、`synchronized`） | ⚠️ 建議修改 |
| 語法符號未當標籤 | 標籤不含語言特殊語法（如 C++ 的 `static_cast<>()`, `[&]()`, `~`；Python 的 `@decorator`） | ⚠️ 建議修改 |
| tooltip 非重複 | tooltip 翻譯與 message0 翻譯不同 | ⚠️ 建議修改 |
| 同類風格一致 | 與同 category 現有標籤使用相同句式 | ⚠️ 建議修改 |
| i18n key 存在 | 所有引用的 `%{BKY_...}` key 在兩個語系檔中都有定義 | ❌ 阻擋 |

**輸出**：
```
i18n 標籤審計：
- 中文描述式：✅/⚠️（{問題標籤}）
- 英文動詞短語：✅/⚠️（{問題標籤}）
- tooltip 品質：✅/⚠️（{問題標籤}）
- 同類一致性：✅/⚠️（{偏離的標籤 vs 參照}）
- i18n key 完整性：✅/❌
```

**i18n key 缺失為阻擋問題**（積木會顯示原始 key 而非翻譯文字）。其餘為建議修改——自動修復後繼續整合。

### 步驟六：Pattern Priority 衝突偵測（P3 開放擴展）

檢查新概念的 lifter 註冊是否與現有 pattern 發生優先權衝突：

1. 列出新概念註冊的所有 tree-sitter 節點類型
2. 檢查這些節點類型是否已被其他 lifter 處理
3. 如果有重疊，驗證 priority 排序是否正確（更具體的 pattern 應有更高 priority）
4. 確認不會出現「新概念搶走已有概念的 AST 節點」的情況

如果偵測到衝突，報告哪些 pattern 重疊並建議調整 priority。見 §2.3 Pattern 歧義偵測與仲裁。

### 步驟七：註冊驗證

檢查概念在所有必要位置都有正確註冊：

1. **概念註冊表**（核心 `src/languages/{lang}/core/concepts.json` 或 STD `src/languages/{lang}/std/{module}/concepts.json`）
2. **Block spec 註冊表**（核心 `src/languages/{lang}/core/blocks.json` 或 STD `src/languages/{lang}/std/{module}/blocks.json`）
3. **工具箱分類**（`src/languages/{lang}/toolbox-categories.ts`）
4. **Lift patterns**（lifter 註冊或 `src/languages/{lang}/lift-patterns.json`）
5. **如果是通用概念**：所有已支援語言都有實作

### 步驟七之二：掃描殘留 `it.todo` / `it.skip`（強制）

在整合前，掃描 `tests/integration/` 和 `tests/unit/` 中與此概念相關的測試檔，檢查是否存在殘留的 `it.todo` 或 `it.skip`：

```bash
grep -rn 'it\.todo\|it\.skip' tests/ --include="*.test.ts" | grep -i "{concept_or_scope}"
```

對每個找到的 `it.todo` / `it.skip`：
1. **檢查註解中的原因**——如果原因是「等 X 概念實作後」，而 X 概念已在本次或之前整合，**必須立刻修復並啟用該測試**
2. **如果 bug 根因已被本次修改解決**——轉為正式 `it(...)` 測試
3. **仍無法修復的**——確認註解的阻擋原因仍成立，更新註解中的時間/依賴資訊

**殘留 `it.todo` 數量必須在整合摘要中報告。** 整合後不允許存在「應該能修但沒修」的 `it.todo`。

### 步驟八：整合決策

| 狀態 | 行動 |
|------|------|
| 所有檢查通過 | ✅ 繼續整合 |
| 僅有風格/格式問題 | ✅ 自動修復並整合 |
| 邊界案例的 round-trip 失敗 | ⚠️ 整合並記錄已知限制 |
| 型別錯誤或測試失敗 | ❌ 不整合 — 報告問題 |
| 破壞現有概念 | ❌ 不整合 — 這是阻擋問題 |

### 步驟九：最終整合（如果核准）

如果所有檢查通過：

1. **再執行一次完整測試套件**
2. **Git commit**（如果有未 commit 的變更）：
   - Stage 所有概念相關的變更檔案（blocks.json、generators、lifters、concepts.json、lift-patterns.json、toolbox-categories.ts、topics/*.json、tests 等）
   - 不用 `git add -A`，逐檔 stage 避免加入無關檔案
   - Commit message 格式：`feat({lang}): add {concept_name} concept`
   - 如果是由 `/concept.pipeline` 批次調用，跳過 commit（由 pipeline 統一 commit）
3. **建立摘要**

輸出：

```markdown
## 整合完成：{concept_name}（{language}）

### 整合的產出物
- Block spec：核心 `src/languages/{lang}/core/blocks.json` 或 STD `src/languages/{lang}/std/{module}/blocks.json` — {block_type}
- Generator：核心 `src/languages/{lang}/core/generators/{file}.ts` 或 STD `src/languages/{lang}/std/{module}/generators.ts`
- Lifter：核心 `src/languages/{lang}/core/lifters/{file}.ts` 或 STD `src/languages/{lang}/std/{module}/lifters.ts`
- Executor：`src/interpreter/executors/{file}.ts`（可執行概念需實作邏輯，宣告性概念需 noop）
- Concept def：核心 `src/languages/{lang}/core/concepts.json` 或 STD `src/languages/{lang}/std/{module}/concepts.json`
- 測試：`tests/unit/languages/{lang}/{concept}.test.ts`

### 測試結果
- TypeScript：✅ 無錯誤
- 單元測試：✅ {N} 個通過
- Round-trip：✅ {N}/{M} 個程式通過
- 跨概念：✅ {N} 個組合已測試

### Topic 層級樹
- 歸屬於 Topic `{topic_id}` 的 `{level_node_id}` 節點 — 使用者啟用該分支時可用

### 已知限制
- {任何降級為 raw_code 的邊界案例}

### 建議後續
- {可接著新增的相關概念}
```

## 狀態模式

以 `status` 或 `{lang} status` 呼叫時，掃描程式碼庫並報告：

```markdown
## 概念整合狀態

### 語言：{language}

#### 完全整合
| 概念 | Topic 節點 | Layer | 積木類型 |
|------|-----------|-------|----------|

#### 部分實作（缺少某些產出物）
| 概念 | Generator | Lifter | Block | 測試 |
|------|-----------|--------|-------|------|

#### 在 concepts.json 中但無實作
| 概念 | Topic 節點 | 備註 |
|------|-----------|------|
```

## 準則

- **絕不跳過 TypeScript 編譯** — 型別安全是第一道防線
- **絕不跳過現有測試** — 新概念不能破壞已經運作的東西
- **偏好保守整合** — 帶著記錄的已知限制整合，好過強推有問題的程式碼
- **一次一個概念** — 獨立整合並驗證每個概念
- **乾淨的 git 狀態** — 永遠從乾淨的 working tree 開始
- **通用概念需全語言驗證** — 通用概念必須在所有已支援語言中通過測試

## 完成標記（強制）

此 skill 完成後，**必須**輸出以下格式的完成標記：

```
🏁 SKILL_COMPLETE: concept-integrate | {lang} | {concept_name} | {PASS/FAIL} | 殘留 todo: {N}
```

如果未輸出此標記，pipeline 的該概念視為未整合。
