# Specification Quality Checklist: 登錄表導出

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-07
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

> 註：Assumptions 提到 `ToolboxCategoryDef` 已有 `registryCategories`。**保留**——
> 那是「這不是從零建，是把 extraTypes 消掉」的證據，決定了工作規模。FR 段本身零實作細節。

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified（中性形態不進工具箱、課程引用不存在的元件、新元件未被收錄）
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

**規格更正了功能描述裡的一處矛盾**：原本同時寫著「課程清單的元件提及數 166／164 → 0」
與「`topics` 的**選擇**仍是宣告的資料」。讀了 `levelTree` 的實際結構之後
（`L0 基礎 → L1a 函式與迴圈 → L2a 陣列與字串 → L3a STL`，各層 19／20／33／25 顆），
第二句是對的：**那是教學漸進線，導不出來**。

所以那兩個數字**不會歸零，也不該歸零**；錯的是就近性護欄把課程清單算成「實作擴散」。
修法是修量測（FR-009／FR-010），與 097 的完備性 harness 同一個形狀。

**這一處更正讓 E 的帳面收益縮小**（原本宣稱能消掉 43% 檔次裡的一大塊），
但把它寫成「一次性導出」會刪掉人工策展，那個損失沒有測試抓得到。
