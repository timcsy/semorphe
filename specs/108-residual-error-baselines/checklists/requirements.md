# Specification Quality Checklist: 參照元件的讀數要能重新量

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-10
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

> 註：spec 提到「參照編譯器」而非具名工具，需求層維持技術中立；
> 「這個 spec 在還什麼債」一節引用了具體檔案與行號，那是**證據**不是實作指示
> ——沒有它，讀者無法驗證「自動比較的檔案數是 0」這個前提。

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

## 本 spec 特有的檢查（護欄類 spec 的額外門檻）

- [x] **首次執行必須為紅**已寫成需求（FR-012），不是只寫在註記裡
- [x] **自我否證聲明的錨點限制**已寫成需求（FR-010），含可機械檢查的形狀
- [x] **兩條基線不可合併**已寫成需求（FR-008）——這是本輪最容易被「順手簡化」掉的一條
- [x] **缺工具要紅不要 skip**已寫成需求（FR-006）
- [x] **語料分欄**已寫成需求（FR-002、FR-005）——這是已經犯過一次的錯

## Notes

- 驗證於 2026-08-10 一次通過，無需迭代。
- 唯一的判斷取捨：spec 引用了具體檔名／行號作為前提證據。判定為**保留**，
  理由是「自動比較的檔案數是 0」若無出處，下一個讀者會重新推測並可能得到
  與我先前相同的錯誤結論（「19 個檔已經在算了」）。
