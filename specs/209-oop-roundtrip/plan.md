# Implementation Plan: OOP 來回一趟的四個缺陷

**Spec**: [spec.md](spec.md) | **Date**: 2026-11-03

## 做法：照同族已經做過的那一套（第 218 刀 method_def 的 `is_const`、class_def 的基底）

每一個缺陷都是同一個形狀的五步：

1. **元件宣告**加屬性（enum／literal，帶 `default` 與 `_kind_why`）——舊存檔缺這一格時由 `default` 補，不需要另寫遷移；FR-006 用一條「沒有新屬性的節點照樣渲染、產碼」的測試證明。
2. **積木形態**：`field_dropdown` 或 `field_input`，`renderMapping` 對到屬性；標籤（zh-TW／en）。
3. **lift**：在 `strategies.ts` 的那個分支記下來（tree-sitter 節點已經有：`->` 是 field_expression 的運算子、`base_class_clause`、`virtual` 修飾、`type_qualifier const`）。
4. **generate**：照屬性產回。
5. **formalize**：照屬性送（`arrow`、基底、`mbDtor.virt`、`isConst`）。

| # | 元件 | 新屬性 | 積木 | formalize |
|---|---|---|---|---|
| 4 | `method_virtual`、`method_override` | `is_const`（enum，預設 false） | 照 method_def 的 const 下拉 | `isConst` |
| 3 | `destructor` | `is_virtual`（enum，預設 false） | 下拉「一般／virtual」 | `mbDtor.virt` |
| 2 | `struct_declare` | `base_class`（literal，預設空）、`base_access`（enum，預設 public） | 照 class_def 的基底欄位 | 照 class_def 送的基底 |
| 1 | `method_call` | `arrow`（enum，預設 false） | 下拉「.／->」 | `eMCall.arrow` |

## 範圍外（照實降級）

`final`（Cella 還沒有形狀）、多重繼承、virtual 繼承：lift 時照實標成還不支援（raw_code 或 formalize 的 miss），不丟資訊。

## 驗收

每一步都跑該元件的 spec 測試、`declaration-shapes-roundtrip`、`cella-oop-semantics`、`fuzz-cpp-oop`；全部做完跑 `test:guard`、StudyCpp 四支探針（形狀不退步）、重產對照圖、e2e、瀏覽器驗收。
