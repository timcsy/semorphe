# Specification Quality Checklist: 多形態機制——一個元件身分，多個積木形態

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-07
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

> 註：「為什麼是這個」一節引用了 `block-spec-registry.ts:6` 的現況。**保留**——
> 那是本功能存在的**證據**（阻斷點的位置），不是實作指示。需求段（FR）本身零實作細節：
> 說「一個 componentId 能對應多個形態」，不說用 Map 還是陣列。

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified（選不出形態、查不到脈絡、轉換失敗——三者都要求出聲）
- [x] Scope is clearly bounded（Out of Scope 明列 B/C/D/E/F 各項）
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

**SC-001 刻意寫成「不看 tooltip」**：本功能的來源教訓是「tooltip 大多是對的，
MSG0 是說謊的地方」——而 tooltip 要滑鼠停留才看得到，MSG0 是學生一邊拼一邊讀的那句。
驗收若允許看 tooltip，就會驗過一個仍然在誤導人的積木。

**FR-002 寫成「MUST NOT 蓋掉」而非「MUST 支援多個」**：因為蓋掉是**目前的實際行為**，
而不是缺少的功能。這樣寫讓這條需求可以直接對著現況寫出一支會紅的測試。
