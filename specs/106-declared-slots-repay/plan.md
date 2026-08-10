# Implementation Plan: 宣告完整性清償

**Branch**: `106-declared-slots-repay` | **Date**: 2026-08-10 | **Spec**: [spec.md](spec.md)

## Summary

把 lift 真的產出的接點寫進宣告。**15 顆，只改 JSON，不動任何程式碼。**
驗收由護欄 #30 直接給：確定違規 16 → 1。

## FR-004 已完成（動手前的擋門）

A 類六顆的那個屬性**全部是死宣告**——實測：

```
cpp:func_call.args        屬性出現 0 次｜接點有值 1 次
cpp:print_formatted.args  屬性出現 0 次｜接點有值 1 次
cpp:input_formatted.args  屬性出現 0 次｜接點有值 1 次
cpp:forward_decl.params   屬性出現 0 次｜接點有值 1 次
cpp:method_call.args      屬性出現 0 次｜接點有值 1 次   ← 本輪補量
cpp:func_def.params       屬性出現 0 次｜接點有值 1 次   ← 本輪補量
```

→ **六顆全部照 A 的修法（移動）**，沒有一顆要走例外。

## Technical Context

**Language/Version**: TypeScript 5.x（本次不改 `.ts`）
**Storage**: 不動（不改身分 ⇒ v9）
**Testing**: Vitest 243 檔／3795 tests
**Constraints**：
- **一顆一個 commit**（宣告是驅動抽取與合成的資料——C1 那次兩度改動兩度還原）
- 行為零改變，且要有機械檢查（FR-003）
- 兩條護欄反向變動，**同一次提交**一起調（FR-007）

## Constitution Check

| 條 | 結果 |
|---|---|
| **I 簡約優先** | ✅ 零新增抽象，只改宣告 |
| **II TDD** | ✅ 護欄 #30 已紅（16 筆），它就是紅燈；行為不變的機械檢查先寫 |
| **III Git 紀律** | ✅ 一顆一個 commit |

## 執行順序

| # | 步驟 | 結束時的狀態 |
|---|---|---|
| **0** | 寫「行為零改變」的機械檢查（FR-003）並錄基準 | 綠 |
| **1–6** | A 類六顆：`args`／`params` 從 `properties` 移到 `children` | 每顆全綠，#30 逐步降 |
| **7–15** | B 類九顆：補上接點宣告 | 同上 |
| **16** | 兩條護欄基線**同一次**調整，說明欄互相引用 | 綠 |

**任一顆紅 → 還原那一顆**，不是就地補。

## Complexity Tracking

零新增複雜度。唯一的新檔是 FR-003 的機械檢查。
