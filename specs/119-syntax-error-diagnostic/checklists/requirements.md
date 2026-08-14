# Specification Quality Checklist: 語法錯誤要當成錯誤來報 ＋ 診斷帶來源

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

### 第一輪：🔴 實作細節洩漏三處

輸入裡有大量具體識別字（`MarkerSeverity.Error`、`semorphe-residual`、
`source: 'component' | 'parser'`、`SYNTAX_ERROR`），照抄進 spec 會讓它變成一份
實作清單而不是規格。

- **改法**：全部換成意圖的說法——「錯誤級」「不同的標記群組」「來源」
  「元件宣告來源／語法解析來源」。
- ⚠️ **而意圖沒有變弱**：FR-004 說的「**兩者的數量要能分開統計**」
  比「用不同的 owner 字串」更難規避——後者可以照做而數字仍然混在一起。

### 第二輪：🟡 最大的風險原本只是一句話

輸入的驗收⑤ 只寫「`unsupported` 仍然是 Info 級」。而**那是本功能唯一
可能傷到使用者的地方**：三種降級原因共用同一段程式碼，一起搬走的話
學生會看到「你的程式有 12 個錯誤」而其中 11 個是我們的問題。

- **改法**：升格成 **User Story 3（P1）**，有自己的獨立測試與兩條驗收場景，
  並在 SC-003 標為「防止一起搬走的那道閘」。
- **理由**：一個只寫在成功標準裡的風險，在實作時容易被讀成「順便確認一下」；
  寫成 User Story 才會有人為它寫測試。

### 第三輪：⚠️ 一條驗收有「靠缺陷通過」的風險

SC-001「程式碼面板出現錯誤級標記」——⚠️ 如果實作把**所有**降級原因
都改成錯誤級，SC-001 照樣通過。

- **改法**：SC-003 與 SC-001 **必須成對讀**，而 US3 的存在讓它不會被略過。
  Edge Cases 也補了一條：「語法錯誤與『我們還不認得』同時出現時，
  一則錯誤級、一則資訊級，**同時可見**」——那是最直接的反例。
- **依據**：`knowledge/experience.md`「一條只描述『差異』的驗收，
  一個壞掉的那一側照樣通得過」——同一個形狀的第二次。

## Notes

- 三輪後全數通過。
- ⚠️ **留給 plan 的兩個實質問題**（都不是 [NEEDS CLARIFICATION]，有明確預設答案）：
  1. 語法錯誤的診斷是**在哪一層產生**的？樹上已經有標記，
     而診斷今天由「規則吃積木」產生——這兩條路要在某處會合。
  2. 一則語法錯誤診斷的**參數**該帶什麼？今天的訊息只有一種深度，
     所以參數可能是空的——而那要與 constitution I（不預留）對照確認。
