# Specification Quality Checklist: 四條護欄——碎裂、殼與缺陷帳的基線與棘輪

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
初稿在 FR 與 User Story 中直接寫了檔名、識別符與工具名（`src/core`、`it.todo`、`block-registrar.ts`、`cpp_string_at`、`component-refactor` skill）。
已改為描述**行為與意圖**：「核心與呈現層」、「被停用的測試」、「最大的雙重真相來源檔」、「專案已有一支負責偵測完備性缺口的既有能力」。
數字基線（13 檔／12 違規／64 todo）也一併移出——它們是**量測結果**，屬於 plan 與 implement 階段的產物，spec 只要求「輸出非零基線數字」（SC-001）。

**第二輪：可測試性（已修）**
「棘輪」原本只在敘述中出現，未成為可驗證要求。已補 FR-003（持平或下降則通過、上升則失敗）、FR-005（必須指出是哪一項上升）、FR-004（調整基線必須顯式且在版本歷史中可見）。

### 刻意保留的張力

- **本功能的驗收標準之一是「數字不為零」（SC-001）**，這與一般「測試要全綠」的直覺相反。這是刻意的：存量太大，第一天綠代表沒有真的量。護欄的形式是**報表加棘輪**，此點已寫入 Assumptions。
- **FR-025 要求報表自我聲明它抓不到什麼**。這不是防禦性文件，是本功能最大的風險緩解——一條只抓得到「殼」的護欄若被誤讀為完備性保證，會比沒有護欄更危險。

### 需在 `/speckit-plan` 階段決定的技術選擇

以下屬實作決策，spec 刻意不指定：

- 「提及某個元件身分」的判定方式（FR-012／FR-042）——影響誤報率，需在 plan 中定案並記錄
- 基線的儲存形式（FR-004）——需支援「顯式調整且在版本歷史中可見」
- 兩種載入組態的具體定義（FR-023）
- 分類標記附著在停用測試上的形式（FR-030～FR-035）
- 完備性護欄的執行頻率是否與其他三條分離（SC-007）
