# Specification Quality Checklist: 存檔層的無聲遺失——欄位守恆與版本閘門

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-06
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

驗證過程中修掉的問題：

1. **第一版把類別名與方法名寫進 spec**（`StorageService.load()`、`importFromJSON`）。已改為「自動載入那條路徑」「匯入檔案這條路徑」——判準是**非技術讀者要能理解，而且實作換掉不影響 spec 是否成立**。原始的檔案位置與行號留在「為什麼做這個」的實測表裡，那裡是證據不是需求。

2. **第一版沒有 US3（拒絕不等於丟掉）**。加嚴閘門是唯一一種能讓事情**比現況更糟**的改法——沒有這個故事，FR-011／FR-012 的「拒絕」可以合法地實作成「清掉重來」。它被列為 P1 而非 polish，因為它是前兩個故事的安全條件。

3. **FR-033 原本寫「釘住一個已知違規」**，與 051 的 FR-022 同形。但 051 的那支測試**通過了卻沒擋住錯誤結論**——它只釘結果不釘理由。已改為「**釘住的是理由不只是結果**」。

4. **FR-017（未知欄位不構成拒絕理由）是驗證時補的**。原本的 edge case 只想到「壞掉的存檔」，沒想到「來自較新版本、版本號卻相同」這種形狀——判嚴會抹掉使用者的資料，代價遠大於判鬆。
