# Specification Quality Checklist: 元件身分命名空間遷移

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-08
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

> ⚠️ 這份規格引用了具體檔案路徑與行號（`storage-version.ts`、`experience.md:150`）。
> 那是**證據**不是實作指示——每一條都在回答「這個要求為什麼存在」。
> 判定：通過。無證據的規格在本專案已經害過一次（E 項的假驗收標準活了兩天）。

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

## Notes

**零個 [NEEDS CLARIFICATION]，理由是設計已拍板**：scope 詞彙、分隔符、
核心不用裸名、不採 `id = 位置`——四個決定都在
`draft/2026-08-07-元件目錄與膠囊契約.md:66-130` 逐條寫定並經人拍板。
本規格的工作是落地，不是重議。

**兩項刻意寫進規格的防禦**（都是這一輪付過學費的）：

1. **SC-006「護欄注入舊格式必須會紅」**——C1 的「values 對下拉」第一次跑就綠，
   因為 values 抄自下拉。由建構保證的綠與真的守住的綠長得一模一樣。
2. **FR-010「第 ② 段不得單靠字串比對」**——中立性護欄踩過裸名撞字，六筆三筆誤報。
