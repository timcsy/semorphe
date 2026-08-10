# Specification Quality Checklist: 宣告完整性清償

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
| 假設沒有防護 | 「A 類的屬性是死宣告，移走沒事」 | 加 **FR-004**：兩顆未實測的**必須先量**，量出有值就不照 A 的修法 |
| 缺一條驗收 | 無 | **SC-002**「`args`／`params` 在屬性宣告裡的出現次數 = 0」——FR-001 的後半（不得同時保留）本來沒有對應的 SC |
| 「行為不變」沒有機械檢查 | 「這是宣告改動」 | **FR-003** 要求機械檢查釘住，**SC-003** 給它數字 |
| 兩條護欄反向變動沒有紀律 | 只說「預期上升」 | **FR-007**：上升與下降**同一次提交**一起調，說明欄**互相引用** |

**沒有列 [NEEDS CLARIFICATION]**：三個可能要問的都有查證得出的預設——
A 類修法（4/6 已實測 ＋ FR-004 擋住其餘）、接點名（沿用 lift 已在用的）、
C 的處置（身分決定，明確排除並說明理由）。

## Notes

- ⚠️ **FR-004 是這份 spec 最重要的一條**：A 的整個修法建立在「那個屬性沒有值」上，
  而那只對六顆裡的四顆實測過。**沒有 FR-004，兩顆未驗的會跟著一起被移掉**，
  而如果它們的屬性真的有值，那就是靜默的資料遺失。
- ⚠️ **SC-003 是「這是宣告改動」的唯一證明**。少了它，任何行為變化都會被
  當成「大概是宣告變了的副作用」而放過。
