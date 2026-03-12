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
2. **關卡**：5 個產出物都存在
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

如果模糊測試發現 bug：修復後重新執行。

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

### Git Commit

如果有概念成功整合，提議 commit：

```
{N} 個 {language} 概念已整合。要建立 commit 嗎？

建議的訊息：
  feat({lang}): add {topic} concepts ({concept_list})
```

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
