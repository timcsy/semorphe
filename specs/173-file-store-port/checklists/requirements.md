# Specification Quality Checklist: 把核心從 `localStorage` 上拔下來

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-06
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
      ⚠️ **判定**：spec 提到 `localStorage` 與檔名。那不是「怎麼實作」，
      是**這筆債今天躺在哪裡**（9 處）——少了它，讀的人無從確認它存在。
      FR 本身一個 API 名都沒有（用「宿主的儲存 API」）。
- [x] Focused on user value and business needs
      ⚠️ 這一刀的價值是**負的形式**：「學生的東西還在」。
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
      🔴 三個會需要拍板的都由帶理由的預設解掉了（A-001 ~ A-003）。
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable（SC-001 是硬性零：9 → 0）
- [x] Success criteria are technology-agnostic
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
      🔴 其中兩個是真的風險：**拒絕時的備份**也走 storage（不搬就只做一半），
      以及**兩把不同的鑰匙**共用一個埠。
- [x] Scope is clearly bounded
      🔴 而 Out of Scope 裡有一條**刻意少做**：驗收原文寫「讀／寫／刪／列」，
      而「列」零個消費者 → 不做。理由寫在 A-003。
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- 🔴 **這一刀最容易做錯的地方**：只宣告埠而不接上產品路徑。
  那是這個 repo 記過的「機制有了沒人接」——所以 SC-001（核心裡 9 → 0）
  是**驗收**，不是附帶。
- ⚠️ **刻意少做一個操作**（「列」）是一個決定，不是遺漏。
  > **一個埠上的操作如果沒有人叫它，它記的不是能力，是想像。**
