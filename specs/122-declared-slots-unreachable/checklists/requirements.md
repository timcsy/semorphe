# Specification Quality Checklist: 宣告了的接點在積木上表達不出來

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-14
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

## 驗證過程的記錄（三輪，每一輪都有實質修正）

### 第一輪：🔴 實作細節洩漏

輸入裡有 `renderMapping.inputs`、`dynamicRules`、`blockDef`、`certainViolations`、
`component.json` 等識別字，照抄會讓 spec 變成一份修改清單。

- **改法**：換成意圖——「形態路徑」「積木上放得進去也拿得回來的位置」
  「確定違規數」。
- ⚠️ **而意圖沒有變弱**：FR-001「放得進去的，走完來回 MUST 回得來」
  比「補上 renderMapping」更難規避——後者可以補了對映而資料仍然掉。

### 第二輪：🔴 三個 User Story 原本是同一個

輸入把三顆第一週的元件並列，而它們**受害的性質不同**：

```
字串初始值     「字不見了」——學生看得到，會困惑
多變數         「字不見了」，而比例更高（三個剩一個）
容器大小       🔴 「程式跑起來不一樣」——10 個元素變 0 個
```

- **改法**：拆成 US1／US2／US3，並在 US3 標明
  「⚠️ 前兩個是『字不見了』，**這一個是『程式跑起來不一樣』**」，
  同時加 SC-005（來回之後**執行結果**相同）。
- **理由**：合在一起的話，「資料還在」就會被當成驗收，
  而**行為是否改變**沒有人會去驗。

### 第三輪：⚠️ 「清不掉的那幾筆」原本只是一句話

輸入寫了「推不動的那幾筆要逐筆寫下為什麼」，而那沒有落點。

- **改法**：升格成 **US4（P1）**，兩條場景（為什麼沒清 ／ 清掉需要什麼），
  並在 SC-006 要求分得出「實作了」與「重新分類了」。
- **理由**：🔴 **一筆靜靜留在那裡的違規，與一筆被遺忘的違規長得一模一樣**
  ——而這個專案的量測是棘輪，留著的會被下一個人讀成「已知且接受」。

## Notes

- 三輪後全數通過。
- ⚠️ **留給 plan 的三個實質問題**（都有明確預設答案）：
  1. 12 筆的**逐筆分組**——哪些是「積木已支援只差對映」（便宜），
     哪些要改積木長相（貴）？⚠️ 而 `build-guardrail` 記過
     「一叢違規看起來像一個根因，而那是假設不是結論」
     ——**要在至少兩筆上分別驗過**。
  2. 改積木長相會不會動到**存檔遷移**？⚠️ 那是本專案翻過車的地方。
  3. **一顆元件有多個形態**時（語句版／運算式版），兩個都要改嗎？
     FR-003 說要，而**成本要在 plan 裡估**。
