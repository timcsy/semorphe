---
name: concept-pipeline
description: >
  為 Semorphe 新增概念的端到端管線。
  串接全部 5 個概念 skill：discover → generate → roundtrip → fuzz → integrate。
  當你想從「我要支援 <特性>」到完全整合的概念，用一個指令完成時使用。
  支援任何語言。
user-invocable: true
---

> **語言指示**：所有輸出文件（報告、摘要、註解）必須使用**當前對話的語言**撰寫。下方模板僅為結構參考，實際用語應配合使用者的語言設定。

# 概念管線 — 端到端

## 使用者輸入

```text
$ARGUMENTS
```

參數格式為 `[語言] <目標>`，例如：
- `cpp <algorithm>` — 新增 C++ `<algorithm>` 支援
- `python list comprehension` — 新增 Python list comprehension 支援
- `java Stream API` — 新增 Java Stream API 支援
- `do-while` — 未指定語言時使用預設語言

可選旗標（附加在目標之後）：
- `--dry-run` — 只執行 discover + generate，跳過測試和整合
- `--skip-fuzz` — 跳過模糊測試階段（更快，但較不徹底）
- `--concepts=X,Y,Z` — 只處理探索報告中的特定概念（跳過其餘）
- `--fuzz-count=N` — 要產生的模糊測試程式數量（預設：10）

## 總覽

此 skill 編排完整的概念新增管線：

```
┌─────────────┐    ┌──────────────┐    ┌───────────────┐    ┌──────────────┐    ┌───────────────┐
│  1. 探索     │───▶│  2. 產生      │───▶│  3. Round-trip │───▶│  4. 模糊測試  │───▶│  5. 整合       │
│              │    │              │    │               │    │              │    │               │
│ 研究 &      │    │ BlockSpec,   │    │ 目標性        │    │ 資訊隔離     │    │ 最終關卡，    │
│ 分類概念    │    │ generator,   │    │ round-trip    │    │ 盲測         │    │ 註冊         │
│              │    │ lifter, 測試 │    │ 驗證          │    │              │    │ & commit      │
└─────────────┘    └──────────────┘    └───────────────┘    └──────────────┘    └───────────────┘
     WebSearch          程式碼產生          編譯/執行 &         Agent A+B          tsc + test
     + fetch            + 測試             比較 stdout          雙代理              + 驗證
```

每個階段有一個**通過/不通過關卡**。如果某個階段失敗，管線會停下來報告哪裡出了問題，讓你修復後再繼續。

## 工作流程

### 階段零：Feature Branch 建立

在開始任何概念工作之前，建立獨立的 feature branch：

1. **偵測當前分支**：如果已經在 `{NNN}-{lang}-{topic}` 格式的 feature branch 上，跳過建立
2. **自動編號**：掃描所有本地分支和 `specs/` 目錄，找到最大編號 N，使用 N+1
3. **命名規則**：`{NNN}-{lang}-{short_name}`，例如 `024-cpp-string-ops`、`025-cpp-const-ref`
   - `short_name` 從使用者輸入推導（標頭檔名、特性名、概念群組名）
   - 相關概念群組用一個 branch（如同一標頭檔的多個函式）
4. **建立並切換**：
   ```bash
   git checkout -b {NNN}-{lang}-{short_name}
   ```

**關卡**：已在正確的 feature branch 上。

### 階段一：探索

**調用**：`/concept.discover {lang} $ARGUMENTS`

**關卡**：探索報告已產生（路徑在 `specs/concepts/` 目錄下）

**決策點**：探索後，向使用者呈現概念目錄：

```
在 {language} 的 {topic} 中找到 {N} 個概念：
  通用概念：{list}
  語言特定概念：{list}
  按 Topic 層級樹節點分組：
  {各節點 label}：{概念 list}

建議實作順序：{ordered list}

要處理全部 {N} 個概念嗎？或用 --concepts=X,Y,Z 指定特定的
```

### 階段二：產生（逐個概念）

**對每個概念**，按實作順序：

1. **調用**：`/concept.generate {lang} {concept_name}`
2. **關卡**：6 個產出物都存在（含 interpreter executor）
3. **快速檢查**：`npx tsc --noEmit` — 型別必須能編譯

如果 TypeScript 失敗，在處理下一個概念之前先修復錯誤。

### 階段三：Round-Trip 驗證（逐個概念）

**對每個產生的概念**：

1. **調用**：`/concept.roundtrip {lang} {concept_name}`
2. **關卡**：所有目標測試必須 PASS 或 DEGRADED

如果有 ❌ FAIL：
- 嘗試自動修復
- 修復後重新執行 round-trip
- 如果嘗試 2 次後仍失敗，標記為**已阻擋**並繼續下一個

### 階段四：模糊測試（批次）

**跳過條件**：設定了 `--dry-run` 或 `--skip-fuzz` 旗標。

根據新增概念在 Topic 層級樹中的深度自動決定難度和範疇（scope）：
- 難度：取新概念所在最深層級樹節點的深度（depth 0→easy、depth 1→medium、depth 2+→hard）
- 範疇：從新概念的分類中推導（例如新增了迴圈相關概念則範疇為 `loops`）

1. **調用**：`/concept.fuzz {lang} {difficulty} {scope} {count}`
2. **關卡**：新概念中沒有 SEMANTIC_DIFF、COMPILE_FAIL、SCAFFOLD_LEAK 或 ROUNDTRIP_DRIFT bug

如果模糊測試發現 bug：**必須修復後重新執行**，不得只記錄 todo 就繼續。具體規則：

- **能修的立刻修**：根因已定位且不超出當前範疇的 bug，必須當場修復。修復後將 `it.todo` 轉為正式測試。
- **依賴未實作概念的 bug**：允許留為 `it.todo`，但必須在註解中寫明依賴什麼、何時回頭修。
- **測試檔不可少**：所有被測試過的程式（無論 PASS 或 BUG）都必須有永久 Vitest 測試案例。
- **零 todo 為目標**：階段結束時向使用者報告剩餘 `it.todo` 數量和原因，逐條確認是否可修。

### 階段五：整合（逐個概念）

**跳過條件**：設定了 `--dry-run` 旗標。

**對每個**通過階段 2-4 的概念：

1. **調用**：`/concept.integrate {lang} {concept_name}`
2. **關卡**：所有檢查通過

### 最終：總結報告

```markdown
## 概念管線完成：{language} — {topic}

### 結果

| 概念 | 通用/特定 | 探索 | 產生 | Roundtrip | 模糊 | 整合 | 狀態 |
|------|----------|------|------|-----------|------|------|------|
| {name} | 通用 | ✅ | ✅ | ✅ 5/5 | ✅ | ✅ | 已交付 |
| {name} | {lang} | ✅ | ✅ | ⚠️ 4/5 | N/A | ❌ | 已阻擋 |

### 已交付：{N} 個概念
### 已阻擋：{N} 個概念

### 覆蓋影響
- {language} 之前：{N} 個概念 → 之後：{N+M} 個概念
- 新的 Topic 層級樹覆蓋：各節點新增概念數

### 建議後續步驟
1. 修復已阻擋的概念
2. 值得探索的相關特性
3. 執行 `/concept.fuzz {lang} all 20` 進行更廣泛的回歸測試
```

### Git Commit & PR

如果有概念成功整合：

1. **Stage 所有變更的檔案**（僅概念相關檔案，不用 `git add -A`）
2. **建立 commit**：
   ```
   feat({lang}): add {topic} concepts ({concept_list})
   ```
3. **詢問使用者是否要建立 PR**：
   ```
   {N} 個 {language} 概念已整合到 branch {branch_name}。
   要推送並建立 PR 嗎？(yes/no)
   ```
4. 如果使用者同意，推送並用 `gh pr create` 建立 PR，body 包含概念清單和測試結果摘要

## 錯誤恢復

管線被中斷時，所有中間產出物都會保留。可以透過個別 skill 從任何階段恢復：
- `/concept.generate specs/concepts/{lang}-{topic}.md`
- `/concept.roundtrip {lang} {concept_name}`
- `/concept.integrate {lang} {concept_name}`

## 範例

```bash
# C++ 完整管線
/concept.pipeline cpp <algorithm>

# Python 快速管線
/concept.pipeline python list comprehension --skip-fuzz

# Java 只處理特定概念
/concept.pipeline java Stream API --concepts=stream_map,stream_filter

# 乾跑看看會產生什麼
/concept.pipeline cpp pointer arithmetic --dry-run

# 帶更多模糊測試覆蓋
/concept.pipeline python decorators --fuzz-count=30
```
