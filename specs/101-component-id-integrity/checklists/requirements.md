# Specification Quality Checklist: 元件身分的引用完備性

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-07
**Feature**: [spec.md](../spec.md)

## Content Quality

- [X] No implementation details (languages, frameworks, APIs)
- [X] Focused on user value and business needs
- [X] Written for non-technical stakeholders
- [X] All mandatory sections completed

## Requirement Completeness

- [X] No [NEEDS CLARIFICATION] markers remain
- [X] Requirements are testable and unambiguous
- [X] Success criteria are measurable
- [X] Success criteria are technology-agnostic (no implementation details)
- [X] All acceptance scenarios are defined
- [X] Edge cases are identified
- [X] Scope is clearly bounded
- [X] Dependencies and assumptions identified

## Feature Readiness

- [X] All functional requirements have clear acceptance criteria
- [X] User scenarios cover primary flows
- [X] Feature meets measurable outcomes defined in Success Criteria
- [X] No implementation details leak into specification

## Notes

- ⚠️ **本規格對輸入做了一次 re-route**：機制從 branded type 改成引用完備性護欄。
  理由不是成本，是**輸入的機制達不到輸入自己宣稱的目的**——branded type 攔不到
  「打錯的 componentId」，只攔得到「沒經過建構入口的字串」。實測今天有四筆幽靈身分，
  branded type 一筆都攔不到。
- **SC-001／SC-002 刻意寫成「走完流程後掃樹」而非「掃原始碼」**：原始碼掃描的第一版
  報了 27 筆假的（把積木型別與 AST 節點型別當成元件身分）。走流程掃樹是可信的量測。
- FR-006 刻意允許兩種結論（補齊或移除），但**不接受「先留著」**——那是把一筆已知缺陷
  轉成常駐雜訊。
