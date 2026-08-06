# Specification Quality Checklist: 清償缺陷帳前兩名

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

### 驗證過程中修正的項目

**第一輪：實作細節洩漏（已修）**
輸入描述含大量具體識別符與檔案位置——`lift-patterns.json` 的 `cpp_cout_chain`、`patternType: chain`、`priority 15`、`strategies.ts:17-25`、`init_declarator`、`initializer_list`、`renderToBlocklyState`。這些是**入口位置**，屬 plan 與 implement 階段的產物。

已改為描述**行為與意圖**：「輸出構造的辨識深度」「陣列宣告的初始值保留」「專案已有一支負責除錯已知失敗的既有能力」。
數字基線（21／19／40／85）予以保留——它們是**可驗證的驗收門檻**（SC-001、SC-003），不是實作細節。

**第二輪：可測試性（已修）**
「不放寬斷言」原本只在風險表中敘述，未成為可驗證要求。已補 FR-021（僅得移除停用標記與分類標籤，斷言逐字相同）與 SC-003（可對照驗證）。

「解鎖後仍失敗怎麼辦」原本未定義，會讓 US3 的驗收陷入二值判斷。已補 FR-022：改標為真正的阻斷者、保持停用、列入報告——不視為本功能失敗。

### 刻意保留的張力

- **US2 的場景 4「允許做不到，不允許無聲做不到」是核心而非邊界情形。** 一般會把它寫成 edge case，這裡刻意升為驗收場景——因為本功能治的正是「無聲丟值」，若只要求「保留初始值」而不要求「做不到要出聲」，實作可以合法地在困難情形悄悄退回原狀，而驗收會通過。
- **SC-007「零無聲資料遺失」比 SC-001 的數字目標更根本。** 40 筆測試恢復是可量測的結果；零無聲遺失是它背後的性質。兩者都列，因為只看數字會誘導出「讓測試過」而非「讓行為對」。

### 兩個獨立儀器的分工（值得 plan 階段注意）

輸出構造被**兩支量測同時指向**（缺陷帳 21 筆＋完備性判定為殼）；陣列宣告**只有缺陷帳抓得到**，完備性對它是綠的。

這不是量測不一致，是設計如此：完備性只跑最小樣本（它自己的報表固定聲明「不檢測條件性正確」），而陣列的最小樣本不帶初始值。**plan 階段不應把「完備性是綠的」當成陣列沒問題的證據。**

### 需在 `/speckit-plan` 階段決定的技術選擇

以下屬實作決策，spec 刻意不指定：

- 深層運算元的辨識要在哪一層處理（FR-001）
- 初始值在語義結構中的承載形式（FR-010、FR-014 要求能區分「無初始值」與「空列表」）
- 可見降級的具體標記方式（FR-004、FR-013）
- 多維初始值的層次表達（FR-011）
