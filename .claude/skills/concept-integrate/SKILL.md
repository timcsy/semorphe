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
- [ ] 渲染映射在 block spec JSON 中（或顯式 renderStrategy）
- [ ] Interpreter executor 在 `src/interpreter/executors/*.ts` 中註冊（可執行概念需實作邏輯，宣告性概念需 noop）
- [ ] 單元測試在 `tests/`（含執行測試）
- [ ] 概念在核心 `src/languages/{lang}/core/concepts.json` 或 STD `src/languages/{lang}/std/{module}/concepts.json` 中註冊

如果是通用概念，額外檢查：
- [ ] `src/core/types.ts` 中的 `UniversalConcept` 型別已更新
- [ ] 所有已支援語言都有對應的 generator 和 lifter

如果缺少任何產出物，報告缺少哪些，並建議先執行 `/concept.generate`。

## 工作流程

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
