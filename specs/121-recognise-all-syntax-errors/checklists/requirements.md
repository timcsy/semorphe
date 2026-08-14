# Specification Quality Checklist: 辨識層只認得一半的語法錯誤

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

輸入裡有 `hasErrorDescendant`、`hasError`、`rawCode`、`node.text`、
`}, 300000)` 等識別字，照抄會讓 spec 變成 diff 而不是規格。

- **改法**：換成意圖——「解析器標記錯誤的兩種方式」「傳播旗標」
  「該節點的完整原文」「時間上限」。
- ⚠️ **意圖沒有變弱**：FR-002「標記 MUST 落在最貼近錯誤的節點上，
  MUST NOT 落在整個程式或整個函式上」比「沿用 `claimed` 邏輯」更難規避
  ——後者可以照做而落點仍然錯。

### 第二輪：🔴 最大的風險原本只是驗收第 3 條

輸入把「合法程式不得被誤標」寫成驗收，而**那是本功能唯一可能傷到使用者的地方**：
傳播旗標讓最外層節點永遠帶著錯誤，天真使用會把**整個程式**標成語法錯誤。

- **改法**：升格成 **User Story 3（P1）**，兩條場景（誤標數 0 ／ 落點不往上飄），
  並在 SC-004 加上可否證的量：「被標記的節點數不超過實際出錯的位置數
  ——整個程式被標記即為失敗」。
- **理由**：與 `119`／`120` 同一個判準——只寫在成功標準裡的風險會被讀成
  「順便確認一下」，寫成 User Story 才會有人為它寫測試。

### 第三輪：⚠️ 一條驗收會被「全部通過」蒙混

SC-001「三種寫法全部被標記」——⚠️ 如果實作把**所有東西**都標記成語法錯誤，
SC-001 通過而 SC-003 才會擋下來。

- **改法**：Edge Cases 補了最直接的反例
  「一段程式同時有語法錯誤與『我們還不認得的寫法』→ **兩者分別標記，
  走各自的通道，不得互相污染**」，並在 US1 場景 3 加「今天唯一抓得到的那種
  **不得退步**」。
- **依據**：`knowledge/experience.md`「一條只描述『差異』的驗收，
  一個壞掉的那一側照樣通得過」——**第三次**套用同一條。

## Notes

- 三輪後全數通過。
- ⚠️ **留給 plan 的兩個實質問題**（都有明確預設答案）：
  1. 傳播旗標與「最深節點才標記」的既有邏輯**會不會真的共存**？
     ⚠️ 那個邏輯上一輪是為了防止標記往上飄而寫的，而它當時面對的是
     實體錯誤節點——換成旗標之後**每一層都帶旗標**，判準可能要調整。
  2. US5 的新上限要設多少？⚠️ 判準是「高於實測所需**且留餘裕**」，
     而餘裕多少要說得出理由——太高就等於關掉那個保護。
