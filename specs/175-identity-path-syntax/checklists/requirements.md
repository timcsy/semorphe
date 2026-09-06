# Specification Quality Checklist: 身分的階層與實例的路徑

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-06
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
      ⚠️ **判定**：spec 用「身分」「實例路徑」「擁有者那一段」，不用型別名。
      引用 `concepts/元件.md` 的行號是**規則的出處**，不是實作。
- [x] Focused on user value and business needs
      🔴 而這一刀的「使用者」是**未來三個域的實作者**——它的價值是
      「錯了要全改」那個成本不會發生。
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
      三個決策由帶理由的預設解掉（A-001～A-003）。
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable（SC-005 是硬性零：332 顆一顆都不得被判歧義）
- [x] Success criteria are technology-agnostic
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
      🔴 核心那一個寫出來了：**沒有冒號而帶 `.`**。
- [x] Scope is clearly bounded
      ⚠️ Out of Scope 有一條是**刻意不做**：不自動修正歧義。
      > **一個會自動解掉歧義的機制，會讓那個歧義永遠不被討論。**
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- 🔴 **這一刀最容易做錯的地方**：把「歧義」壓成一個是非。
  那會讓撞號**繼續存在而看不見**——而那正是它要解的東西。
- 🔴 **A-003 是最脆弱的一條**：用明文清單認「我們的分類」。
  ⚠️ Python 真的有 `math` 模組——所以那份清單**會誤傷**，
  而它的緩解是「清單短、每一筆附理由、而且它是可下調的」。
- ⚠️ **SC-006（語言名出現次數 = 0）**是既有中立性護欄的延伸：
  判定那一支住在核心，而 `concepts/元件.md:240` 逐字說了為什麼
  ——「**所以分隔符不能跟語言走**」。
