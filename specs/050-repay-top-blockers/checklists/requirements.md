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

### ⚠️ Phase 0 研究推翻了初稿的兩個前提（2026-08-06，第三輪）

spec 初稿通過了前兩輪品質驗證——**但它的前提是錯的，而品質檢核抓不到這種錯**。品質檢核問的是「需求可測試嗎、範圍清楚嗎」，不問「這個需求描述的問題真的存在嗎」。

實證探測（合成程式碼 → 辨識 → 印出語義樹）發現：

| 初稿主張 | 實測 |
|---|---|
| 輸出構造吃不下深層運算元 | **它吃得下**。檔頭記載的阻斷條件已過期 |
| 40 筆測試可以「開回來」 | **85 筆裡 64 筆沒有測試本體**——只有名字 |
| 「修 X 解鎖 21 個測試」 | 那 21 個不存在 |

spec 已依此改寫（US1–US4 全部重寫，FR／SC／Assumptions／Scope／Risks 全部對齊）。

**這件事本身是本專案剛記下的那條教訓的第三個實例**：量測工具的錯，有一類**只有在你照它行動時才會現形**。缺陷帳的數字對、分類對，只有「停用測試」這個詞把兩種需要完全不同工作量的東西包在一起——而這個語義錯，要到有人拿它去規劃真實工作時才會暴露。

**流程上的教訓**：spec 的品質檢核應該加一項——**「本 spec 的問題陳述，有沒有被實證確認過？」** 目前的檢核表全部是形式性的（可測試、可量測、範圍清楚），沒有一項在問「這是真的嗎」。

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

### 技術決策已在 Phase 0 定案（見 `research.md` D1–D5）

- **D1** 初始值承載形式：`array_declare` 新增具名子槽；「無初始值」＝欄位不存在、「空列表」＝空陣列
- **D2** 可見降級：用既有的信心等級與降級原因，不發明新標記
- **D3** 輸出身分不保：**只釘住不修法**——兩條修法都會動到跨風格的已知坑
- **D4** 停用項目分兩類計數，阻斷者彙總只算有本體的
- **D5** 重新歸因只更正註解已寫明的，其餘標「歸因待確認」
