# Specification Quality Checklist：目標（target）第二刀

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-17
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
  - ⚠️ **一次判定改過**：初稿的 FR-001 寫「用一個下拉選單」——那是實作。
    改成「單一一次選擇」＋ SC-009「選擇器總數不增加」，**判準保留而做法放開**。
- [x] Focused on user value and business needs（老師選一次／學生看不到不存在的東西）
- [x] Written for non-technical stakeholders
  - ⚠️ **例外且刻意**：`grep` 那一段與 FR-006/007 帶了機械細節。
    理由是本功能的**觸發事實**就是那個 grep 結果，抽掉它規格會失去出處。
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain（0 個——三個範圍問題都有既有判準可推）
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable（9 條全部是數字或逐字比對）
- [x] Success criteria are technology-agnostic
  - ⚠️ SC-007 提到「46 條護欄」「4201 個測試」——那是**回歸底線**不是實作細節，保留。
- [x] All acceptance scenarios are defined（3 個故事 × 3 個場景）
- [x] Edge cases are identified（4 個，含存檔遷移與「競賽清單不得消失」）
- [x] Scope is clearly bounded（「明確排除」5 條）
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

🔴 **這份規格有一條與眾不同的驗收：SC-005 要求那條護欄在接上之前是【紅】的。**
一般規格只驗「做完之後是綠的」。而 `build-guardrail` 6.5 逐字：

> 「第一次綠有三種可能，沒有一種是好消息：判準寫錯了、資料沒載入、
> 或**基線是先產生的**（那等於把現況直接封為合格）。」

→ 實作時**必須**先跑一次紅的、把 `TargetRegistry` 指名出來，**再**去接。

⚠️ **第二件不尋常的事：SC-009 是一條反目標。**
多數規格說「要有什麼」，這一條說「**不准多出什麼**」——
因為目標這個機制最容易的失敗方式不是做不出來，是做成**第三個並列的選擇器**，
那樣它不但沒有收攏，還讓事情更複雜。
