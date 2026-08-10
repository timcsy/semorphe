# Specification Quality Checklist: 參數列工廠

**Created**: 2026-08-10 ｜ **Feature**: [spec.md](../spec.md)

## Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic
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

| 問題 | 改成 |
|---|---|
| 「順手修 i18n 不一致」沒有防護 | **FR-003 ＋ 邊界**：fallback 必須是原本那兩個字元，否則是行為改變不是修正 |
| 沒說清楚驗收靠什麼 | **FR-006**：這次沒有自動化替代品，瀏覽器實測是主要手段而非補充 |
| grep 測試可能變紅而被誤讀 | 寫進邊界：**那是錯誤的理由**——能力沒消失，只是被共用了；並據此決定工廠不另開檔案 |

## Notes

- ⚠️ **這份 spec 最重要的一句在「沒有自動化安全網」那節**。12 對 `plus_`／`minus_`
  零行為覆蓋，而 `block-registrar.test.ts` 的四支測試是 grep 檔案文字——
  **它們全綠不代表這次重構是對的**。
