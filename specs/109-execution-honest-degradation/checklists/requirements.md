# Specification Quality Checklist: 執行那一路的誠實降級

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-10
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

> 註：需求層用「輸出串流」「參照編譯器」而非具名 API；
> 「這個 spec 在治什麼」與「給實作者的警告」引用了檔案行號，
> 那是**證據與既有決定的出處**，不是實作指示——沒有它們，
> FR-012「只能宣告已記錄過的缺口」無法驗證。

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

## 本 spec 特有的檢查（「宣告」類 spec 的額外門檻）

這一輪的風險不在做錯，在**做對了但把缺陷洗成設計**。四條需求是那條分界的機械化：

- [x] **FR-009 分欄**已寫成需求——不是報表美化，是「缺口有沒有更容易看見」的判準
- [x] **FR-010 總和不變**已寫成需求——擋掉「重新分類 = 改善」
- [x] **FR-012 只能宣告已記錄過的缺口**已寫成需求——擋掉用宣告吸收新發現
- [x] **FR-007 不支援 ≠ 本來就不執行**已寫成需求——`execute: "noop"` 那條路的
      門檻是「理由值不得增加」，這裡是**新增一個值**，所以必須說清楚它為什麼不同

- [x] **FR-006 反向注入**（完全支援的程式不得產生訊號）已寫成需求
      ——沒有它，一個「什麼都報未支援」的實作也會通過 FR-005

## Notes

- 驗證於 2026-08-10 一次通過。
- 唯一的判斷取捨：spec 保留了 A/B/C 三類的實測細節（`char c=66` 印出 `6` 等）。
  判定為**保留**——若無這些，下一個讀者會重新推測 31 筆的性質，
  而我自己在規劃時就猜錯過一次（`isupper` 那筆），已寫進 spec 的警告區。
