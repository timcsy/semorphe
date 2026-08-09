# Specification Quality Checklist: F 膠囊搬家——第一顆垂直切片

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-09
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

**第 1 輪**

| 問題 | 原文 | 改成 |
|---|---|---|
| FR-002 洩漏實作 | 「五路實作住在 `behavior.ts`」 | 「住在同一個資料夾底下」——檔名是 plan 的事 |
| FR-003 用了實作詞 | 「i18n 檔」 | 「顯示標籤（含全部語言）」 |
| SC-001 不可驗 | 「就近性 → 0」 | 「非清單類檔案數 8 → 0」——8 是查證過的數字 |
| 缺一條驗收 | 無 | SC-006 可拆性（刪掉資料夾其餘元件零失敗）——US1 場景 3 本來沒有對應的 SC |
| 假設沒說出不確定性 | 「膠囊位置是 `components/<scope>/<name>/`」 | 加註「**這是本 spec 的假設，不是已拍板的決定**」 |

**沒有列 [NEEDS CLARIFICATION]** 的理由：三個原本會標的地方都有查證得出的預設——
膠囊路徑（從 D 的 `<scope>:<name>` 直接落出）、共同測 harness（膠囊契約自己說要先量一顆）、
清單類豁免（沿用現行就近性護欄已生效的判準）。

## Notes

- ⚠️ **FR-014 是這份 spec 最容易被忽略的一條**：新護欄要涵蓋「宣告」類共用，
  而現行就近性只算「實作」類。兩個維度的數字必須**分開呈現**，
  否則 F 收工時的漲幅會混進一次維度變更——`knowledge/history/018` 的「用宣告刷數字」。
- ⚠️ **顯示標籤那一維（FR-012）是新發現的盲區**，不是既有待辦。
  它是「選了哪一維會消失在數字裡」的第五個實例。
