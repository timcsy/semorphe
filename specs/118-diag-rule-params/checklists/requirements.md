# Specification Quality Checklist: 診斷訊息由「一個字串」改為「規則 ＋ 參數」

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

## 驗證過程的記錄（三輪，前兩輪有實質修正）

### 第一輪：🔴 兩處實作細節洩漏

- **SC-002 原本寫**「`Diagnostic.message` 欄位不存在」——那是型別名稱，是實作細節。
  → 改成「『單一訊息字串』這個欄位在系統中不存在（0 處引用）」。
- **FR-001 原本寫**「改成 `rule: string` ＋ `params: Record<string, string|number>`」
  ——直接寫了型別簽章。
  → 改成「MUST 攜帶它是哪一條規則與這次觸發的相關資訊，
  而 MUST NOT 攜帶任何已經組好的字串」。⚠️ **意圖沒有變弱**：
  「不得攜帶組好的字串」比「欄位叫什麼」更難規避。

### 第二輪：🟡 一條驗收量錯了東西

- **SC-004 原本寫**「端對端驗證仍然通過」——而 `experience.md:1155` 逐字警告
  「一支斷言『檔案裡有這個字串』的測試，全綠不代表行為是對的」。
  一支只確認「兩個面板都有標記」的測試，在**兩邊共用同一句話**時照樣全綠
  ——那正是本功能要消滅的狀態。
  → 補上注入要求：「把兩個面板的組法改成同一個時，該驗證**必須失敗**」。

### 第三輪：⚠️ 一條假設可能違憲，已就地說明理由

- **「參數集合今天可以是空的」** 與 constitution I「簡約優先／不得為假設性未來需求預留擴充」
  表面衝突：現有 4 條規則都不需要參數，那為什麼要有參數這個管道？
  → **理由已寫進 Assumptions**：沒有參數就沒有「組裝」可言，
  兩個面板只能各查一張死表，FR-002（各面板獨立組裝）就無從成立。
  **管道是本功能的必要條件，不是預留。**
  ⚠️ 這一條交給 `/speckit-plan` 的 Constitution Check 複審——
  如果 plan 判定「兩張死表也能滿足 FR-002」，那參數就該被砍掉。

## Notes

- 三輪後全數通過。
- 🔴 **留給 plan 的唯一實質疑問**：參數管道是否為必要（見第三輪）。
  這不是 [NEEDS CLARIFICATION]——它有明確預設答案（必要），
  只是該由 Constitution Check 再確認一次。
