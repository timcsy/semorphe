# Specification Quality Checklist: 型別的下拉要跟著程式長

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-06
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
      ⚠️ spec 引用了實測結果（`cpp:vector_declare` 的 `type` 是元素型別）
      ——那不是「怎麼實作」，是**一條會影響範圍的事實**。
- [x] Focused on user value and business needs
      🔴 使用者回報過這一族（`int**` 選不到），而這是它的最後一格。
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
      打錯字那個決策由帶理由的預設解掉（A-001，**代價不對稱**）。
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable（SC-003 是逐字比對，含順序）
- [x] Success criteria are technology-agnostic
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
      🔴 而其中一個是**量出來的，不是想出來的**：容器與指標的 `type`
      是元素型別。它改變了這一刀的範圍。
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- 🔴 **這一刀最容易做錯的地方**：把內建清單重排。
  > **一份清單的順序，在有人照著它寫教材之後就是介面的一部分。**
- 🔴 **而第二容易錯的**：以為掃描漏了 `vector<int>`。
  那條界線是**刻意的**，而它要被一支測試釘住——否則下一個人會去「修」它。
