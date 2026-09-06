# Specification Quality Checklist: 讓 lift 樣式問得出「這個名字被宣告過嗎」

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-06
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
      ⚠️ **判定**：spec 提到檔名與那份病歷。那不是「怎麼實作」，是**這個決定的來歷**
      ——而少了它，讀的人會以為「拿掉樣式」是一個疏漏而不是一個判斷。
      FR 本身用的是「名字的比對條件」「作用域」，不是型別名。
- [x] Focused on user value and business needs
      🔴 US3（積木來回不掉形狀）是**每一個 Arduino 課學生都會遇到**的。
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
      命名那個決定由帶理由的預設解掉（A-001）。
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable（SC-001／002 是逐字的輸出）
- [x] Success criteria are technology-agnostic
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
      🔴 其中兩個是真的風險：**宣告的順序**（寫在使用之後會怎樣）
      與**作用域彈出的時機**。
- [x] Scope is clearly bounded
      ⚠️ Out of Scope 裡有一條是**刻意留下的近似**：不做兩趟掃描，
      所以「宣告寫在使用之後」仍然會被搶。
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- 🔴 **這一刀最容易做錯的地方**：修好 US1（不搶）而弄壞 US2（沒人宣告時仍要認）
  ——那等於把功能刪掉，而測試只驗 US1 的話它會全綠。
- 🔴 **A-002 是一個刻意接受的近似**：「查不到」＝「沒有人宣告」。
  它偏向安全的那一邊（查不到時行為與今天相同），而那句話要寫在程式碼裡，
  不然下一個人會以為它是完備的。
