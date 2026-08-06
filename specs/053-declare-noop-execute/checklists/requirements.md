# Specification Quality Checklist: 讓「刻意不執行」說得出話

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-06
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

## Notes

驗證過程中修掉的問題：

1. **第一版的立意是「execute 搬回語言套件」**——那是照著路線圖 P2 的字面寫的。實測之後整個換掉：`interpreter.ts` 的 61 筆違規裡有 34 筆是**一份寫死的「無執行行為」清單**，而不是執行器。搬檔案解決不了它，**把清單換成宣告**才行。

2. **第一版把「宣告 31 個概念、兩個護欄數字同時下降」當成主要成果**。寫到一半發現那正是這個功能最危險的地方——**宣告會讓數字下降卻不改變任何行為**。若那 34 個裡混著「還沒實作、只是做成空的」，這個功能就是在把缺陷洗成宣告，而且護欄會替它背書。US1 因此從「順手做的分類」升格成整個功能的地基，而且明訂**先判斷再宣告，順序不可反**。

3. **加了 FR-042 與對應的風險列**：判為「還沒實作」而改成報錯，會讓原本能跑的程式跑不了。這是 `history/017`「加嚴一個檢查可能比不檢查更糟」的同一形狀——那條剛在上一個功能學到，這裡是它的第一次應用。

4. **自我否證提示寫進 Assumptions**：「若 34 個全部判為真的不執行，那反而要懷疑判準太鬆」。沒有這句的話，最省事的做法（全部宣告）看起來會像最成功的結果。

5. **SC-003 留了餘量**（`interpreter.ts` 61 → ≤15 而非 → 0）。剩下的 12 筆除錯步驟清單由 US3 處理，其餘零星提及可能無法在本功能範圍內清掉——**寫一個做不到的目標，等於把驗收變成談判**。
