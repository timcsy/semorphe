# Specification Quality Checklist: 執行那一路搬回它的模組

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

1. **第一版把主防線寫成「逐一比對輸出」**。那個防線**漏一個不會現形**——某個概念的執行器掉了而測試剛好沒覆蓋它，輸出比對全綠。改成 FR-010「搬移前後執行引擎認得的概念集合必須完全相同」，那是漏一個就現形的形狀。這與「與其偵測錯誤，不如換一個讓錯誤無法被表達的形式」是同一招。

2. **加了 US3（「忘了載入語言套件」要當場說清楚）**。搬移擴大一個既有相依，而上一輪同類改動的失敗訊息只說「未知概念」——看不出真正原因。**風險已先量過**（3 個測試檔建立執行引擎卻沒載入語言套件），所以 US3 的規模是已知的，不是防禦性猜測。

3. **FR-003 拆分那條是寫 spec 時才想到的**：涵蓋多模組的那份若整份塞進單一模組，使用者只用其中一個標準函式庫時會連帶載進另外四個的執行器——那把碎裂換成了耦合，不是修好。

4. **「整份可搬」的判準寫成實測比例而非印象**（該檔語言專屬佔 ≥90%；四份實際都是 100%）。沒有這個判準，「哪些算整份可搬」會變成每次重新爭論的事。
