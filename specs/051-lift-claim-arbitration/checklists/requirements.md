# Specification Quality Checklist: 讓「誰認領這段語法」不再靠運氣

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-06
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

## Notes

### 這次先做了 spec 050 教會的事：**問題陳述已經實證確認過**

050 的教訓是「spec 初稿通過了前兩輪品質驗證，但前提是錯的——品質檢核問『可測試嗎』，不問『這是真的嗎』」。

所以本 spec 的問題陳述在**寫之前**就用實測建立：

| 主張 | 實證 |
|---|---|
| 30% 的規則靠登記順序決勝負 | 實際載入後量測：76 條規則、47 種語法節點、23 條落在同語法同優先權群組 |
| 最大的一群有 8 條 | `declaration` @priority=10 共 8 條，逐條列得出來 |
| 這會造成真實傷害 | 050 實作時撞到，已記進缺陷帳 |

**問題陳述是量出來的，不是推論出來的。**

### 驗證過程中修正的項目

**第一輪：實作細節洩漏（已修）**
輸入描述含大量識別符與機制名（`PatternLifter`、`addPattern`、`calcPriority`、`tryLift`、`Map.set`、`cpp_string_declare` 等）。已改為描述行為：「辨識規則」「限定條件」「登記先後」「同一種語法節點」。

**數字保留**（76／47／23／8）——它們是可驗證的驗收門檻（SC-001、SC-005），不是實作細節。

**第二輪：US2 的可測試性（已修）**
初稿只說「要區分會不會撞」，沒說判不出來時怎麼辦——那會讓實作在困難情形自由選擇歸類，而且多半會歸向「不會撞」（數字比較好看）。已補 FR-011／FR-012：**「無法確定」獨立呈現、不計入安全、判不出來不得歸入「不會撞」**。

### 刻意保留的張力

- **「無法確定」是一等公民，不是失敗**。這是 050 的 `[UNVERIFIED]` 同一個形狀：沒有它，實作只剩「猜一個」或「漏掉」，兩條都比承認不知道差。它的數量本身也該是棘輪，避免變成新垃圾桶。
- **US1 量「同優先權」、US2 量「會不會撞」，兩者刻意都做**。前者是代理指標、算得準但可能誤報；後者是真問題、但判不準。只做前者會誤報，只做後者會漏報——**兩個一起看，差異本身就是資訊**。
- **SC-005 要求「已知的那組必然出現」**。這是 FR-022 的驗收面：一條抓不到已知案例的護欄，比沒有護欄更危險。

### 需在 `/speckit-plan` 階段決定的技術選擇

- 「限定條件互斥」怎麼判（FR-010）——直接影響誤報率與「無法確定」的比例
- 「重複登記」與「優先權設計」怎麼區分（FR-013）
- 護欄在何處取得載入後的規則集合（FR-001），且不得影響正常載入路徑（FR-030）
- 三個分類數字各自的基線與棘輪形式
