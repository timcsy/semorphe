# Specification Quality Checklist: 符合性清償——函式族的參數

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-10
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## 驗證過程中修掉的問題

| 問題 | 原文 | 改成 |
|---|---|---|
| FR-001 洩漏實作 | 「render 把 `param_decl` 序列化進 `PARAMS` 欄位」 | 「參數保持結構化（型別與名字各自可取得）」——**怎麼存**是 plan 的事 |
| FR-002 用了機制名 | 「新增 `childrenAsField` 映射」 | 「由一個共用機制提供，各元件只加宣告」 |
| 取捨沒有出口 | 假設只寫「沿用文字欄位」 | 加上**三個升級訊號**——一個取捨若沒有退出條件，它會永遠留著 |
| 邊界不足 | 只列零參數 | 補上型別含分隔符（`map<int,int>`）、只有型別沒名字、預設值、無法解析的輸入、`method_virtual_pure` 沒有 body |
| 缺一條驗收 | 無 | SC-004「新增同族元件 0 個共用檔被修改」——US2 本來沒有對應的 SC |

**沒有列 [NEEDS CLARIFICATION]** 的理由：三個可能要問的都有查證得出的預設——
積木外觀（那六顆今天就長這樣）、語義層結構（lift 實測產出 `param_decl`）、
範圍（`vector_declare` 的形狀不同已量過）。

## Notes

- ⚠️ **本 spec 最容易被忽略的是 FR-003**：一顆有 `params` 接點卻沒宣告映射的元件
  必須**被報為違規**。少了它，這次的修法會變成「六顆各寫一行，而第七顆忘了寫也沒人知道」
  ——那正是這條護欄存在的理由。
- ⚠️ **SC-003 是這個方向最明顯的失敗模式**：用文字承載參數，分隔符就是風險。
  結果允許「明確不支援」，但**不允許靜默拆錯**。
