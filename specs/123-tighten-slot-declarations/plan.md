# Implementation Plan: 兩筆宣告與現實不符

**Branch**: `123-tighten-slot-declarations` | **Date**: 2026-08-14 | **Spec**: [spec.md](spec.md)

## Summary

符合性量測**照著宣告合成一棵樹**。兩筆宣告與現實不符，於是它造出
`5.field` 與 `int a, 5;`——**真實世界不存在的樹**——再回報它們走不通。

## Technical Context

TypeScript 5.x｜Vitest｜異動預估 2 個 `component.json` ＋ 基線說明

**Constraints**: 🔴 其餘量測基線不動；來回與執行結果**逐字相同**

## Constitution Check

| 原則 | 判定 |
|---|---|
| **I. 簡約優先** | ✅ 只刪兩個不對應現實的宣告 |
| **II. TDD** | ✅ 先跑對照組（`declaration-change-parity`）記下**移除前**的結果 |
| **III. Git 紀律** | ✅ 兩筆分開 commit——⚠️ 而它們的**出處不同**（一個是參數、一個是沒有產生端） |
| **IV／V** | ✅ |

⚠️ **正面說**：本功能**刪宣告讓數字下降**，從外面看與「用宣告刷數字」一模一樣。
**唯一的差別是出處**——所以 plan 的每一步都要求先拿出出處再動手。

## Q（plan 的問題）：產生器還讀著 `declarators`，那個分支怎麼辦

```
src/components/cpp/var_declare/generate.ts:11  const declarators = node.children.declarators ?? []
src/languages/cpp/core/lifters/strategies.ts:365-372
  多變數宣告 lift 成 `_multi_field` 包一組【獨立的 var_declare】
  🔴 從來不產生 `declarators` 接點
```

### 決策：**留著產生器的分支，而把它記成死程式碼**

- **Rationale**：刪掉它是**第二件事**（死匯出的清理），
  而混進來會讓「移除宣告是否改變行為」這個驗收失去對照。
- ⚠️ 而 `orphan-implementations` 那條護欄的基線是 **1**——
  這一筆該不該進去，是它的問題不是本功能的。
- **記在**：`conformance.json` 的說明裡（FR-005）。

## Structure

```text
src/components/cpp/struct_at_member/component.json   🔴 移除 children.obj
src/components/cpp/var_declare/component.json        🔴 移除 children.declarators
tests/baselines/conformance.json                     🟡 數字 ＋ 兩種下降分開記
```
