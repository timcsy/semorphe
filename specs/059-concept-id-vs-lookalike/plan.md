# Implementation Plan：分辨概念身分與撞名字串

**Branch**: `059-concept-id-vs-lookalike` ｜ **Date**: 2026-08-06 ｜ **Spec**: [spec.md](./spec.md)

## Summary

中立性護欄用純文字比對判定，於是與概念身分撞名的普通英文單字被計為違規。修判定、把核心層的註解語法搬進語言套件、最後才改分層——**三步分開量、分開 commit**。

## Technical Context

| | |
|---|---|
| **語言** | TypeScript 5.x |
| **新增相依** | **無**（規格明訂） |
| **測試** | Vitest |
| **改動範圍** | `tests/helpers/component-scan.ts`、`tests/integration/audit-neutrality.test.ts`、`src/core/projection/code-generator.ts`、`src/core/lift/lifter.ts`、C++ 語言套件、三個概念定義的 `layer` |
| **NEEDS CLARIFICATION** | 無（Phase 0 全部解決） |

## Constitution Check

| 條款 | 狀態 |
|---|---|
| I 簡約優先 | ✅ 沿用既有遮罩機制，不引入型別分析器。**候選的三個遮罩只採用兩個**——第三個被實測否決 |
| II TDD（非妥協） | ✅ 兩支注入測試先寫（契約 1）；搬移前先拍產出快照（契約 2）。**兩者都必須先紅** |
| III Git 紀律 | ✅ 三步各自 commit，每步附當時的量測數字 |
| IV 規格文件保護 | ✅ 只增不刪 |
| V 繁體中文 | ✅ |

**無違規，無需 Complexity Tracking。**

## Phase 0：Research ✅

見 [research.md](./research.md)。五個決策，其中兩個推翻了原本的假設：

1. **遮罩 B 被實測否決**——它會遮掉 14 筆真違規（`block.type === 'cpp_string_declare'` 等）
2. **`lifter.ts` 有護欄看不見的耦合**——第 152 行在核心層剝 `//` 與 `/* */`，FR-012 涵蓋它，搬移範圍因此是兩處
3. **SC-001 從 ≤23 改為 ≤24**——為了打到先寫下的數字而放寬判定，正是本功能在防的事

## Phase 1：Design ✅

見 [data-model.md](./data-model.md)。五個契約，其中契約 1（雙向注入）是主防線。

無對外介面契約目錄——本功能改的是內部量測與投影落點，不新增任何使用者可見的介面。

## 實作順序（不可反）

```
① 修量測  → 量 → commit（預期 29 → 27，全部記在「誤報」欄）
② 搬投影  → 量 → commit（預期 27 → 24，全部記在「搬走」欄）
③ 改分層  → 量 → commit（預期 24 → 24，分層改動不影響計數，因為語法已經不在核心）
```

**③ 的預期是「數字不動」，這件事本身就是驗證**：如果改分層讓數字掉了，代表 ② 沒搬乾淨——那三筆是靠標籤消失的，不是靠搬走。

## 風險

| 風險 | 緩解 | 在哪驗 |
|---|---|---|
| 遮罩濾掉真違規 | 雙向注入 | 契約 1 |
| 搬移途中掉了某條路 | 產出快照逐一比對 | 契約 2 |
| 用修量測刷分數 | 兩欄報表 | 資料模型「兩欄報表」 |
| ③ 搶在 ② 之前 | ③ 的預期是數字不動；動了就代表 ② 沒做完 | 實作順序 |
