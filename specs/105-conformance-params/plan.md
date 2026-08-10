# Implementation Plan: 符合性清償——函式族的參數

**Branch**: `105-conformance-params` | **Date**: 2026-08-10 | **Spec**: [spec.md](spec.md)

## Summary

新增一個宣告式映射 `childrenAsField`，讓 render 把 `param_decl` 子節點序列化進
既有的 `PARAMS` 文字欄位、extract 解析回子節點。**一個機制，六份宣告。**

驗收由第二十九條護欄直接給：確定違規 **7 → 1**。

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: 不新增
**Storage**: 不動（只加映射不改身分 ⇒ 存檔版本維持 v9）
**Testing**: Vitest（240 檔／3749 tests，每顆元件改完必須綠）
**Project Type**: 單一專案
**Constraints**:
- 六顆的**積木外觀不變**（FR-008）
- 不得為每顆元件複製行為程式碼（FR-002）
- 分隔符處理要嘛正確、要嘛**明確不支援**，不得靜默拆錯（FR-005）

## Constitution Check

| 條 | 檢查 | 結果 |
|---|---|---|
| **I 簡約優先** | 為假設性未來預留？ | ⚠️ `childrenAsField` 是新型別，但**當前有六個消費者**，不是預留 → 通過。明確不做：不擴充成通用的「任意結構 ↔ 任意文字」，只做「子節點列表 ↔ 一個欄位」 |
| **II TDD** | 測試先於實作？ | ✅ 護欄 #29 已經紅著（7 筆），它就是這次的紅燈；另外先寫分隔符的邊界測試再實作 |
| **III Git 紀律** | 每步 commit？ | ✅ 機制一個 commit，六顆各一個 |

**無違規需要記錄。**

## Project Structure

```
src/core/
├── types.ts                          ← 新增 ChildrenAsField 型別
└── projection/
    ├── children-as-field.ts          ← 新增：序列化／解析（含角括號深度）
    ├── pattern-renderer.ts           ← 消費宣告（寫欄位）
    └── pattern-extractor.ts          ← 消費宣告（讀欄位）

src/languages/cpp/core/blocks.json    ← 五顆加宣告
src/languages/cpp/.../blocks.json     ← template_function 加宣告

tests/
├── unit/children-as-field.test.ts    ← 分隔符與型別切分的邊界（先寫）
└── integration/
    └── roundtrip-func-family.test.ts ← 六顆 × 有參數／無參數
```

**Structure Decision**：序列化／解析獨立成 `children-as-field.ts`——
它是純函式，而 render 與 extract **兩邊都要用**。分兩份就是兩份會漂移的真相
（這階段的頭號病）。

## 執行順序

| # | 步驟 | 結束時的狀態 |
|---|---|---|
| **0** | 錄六顆的來回基準（有參數 ＋ 無參數 ＋ 分隔符樣本） | 基準存在，**其中 6 個樣本是紅的**（那就是要修的） |
| **1** | 寫 `children-as-field.ts` 的**邊界測試**（分隔符、型別切分、零參數）＋ 實作 | 單元測試綠 |
| **2** | `RenderMapping` 加型別，render 側消費 | 全綠（無人宣告，是 no-op） |
| **3** | extract 側消費 | 全綠（同上） |
| **4** | `cpp:lambda` 加宣告 | 全綠 ＋ lambda 樣本逐字相同 ＋ 護欄 7 → 6 |
| **5–9** | 其餘五顆各加宣告 | 每顆一個 commit，護欄逐步降到 **1** |
| **10** | 瀏覽器實測（SC-007） | — |

> **步驟 2、3 結束時全綠是刻意的驗收**：新機制在沒有人宣告它的時候
> **必須是 no-op**。若那時就有測試變紅，代表它動到了不該動的東西。

## Complexity Tracking

| 新增的複雜度 | 當前需求 | 不加會怎樣 |
|---|---|---|
| `ChildrenAsField` 型別 | 六顆元件的參數 | 六份會漂移的 strategy |
| `children-as-field.ts`（深度感知的分割） | `map<int,int>` 這種型別 | 靜默拆錯，症狀是參數變多且每個都是垃圾 |

**明確不加**：通用的「任意結構 ↔ 任意文字」轉換器、
把六顆改成 `func_def` 那種動態積木、`cpp:vector_declare` 的變長初始值。
