# Specification Quality Checklist: lift 樣式的型別驗證 ＋ 行為等價

**Created**: 2026-08-20 · **Feature**: [spec.md](../spec.md)

## Content Quality
- [x] No implementation details（`patternType` 是**被驗的資料**，不是實作選擇）
- [x] Focused on user value（讀不懂的宣告會靜靜降級 → 學生的程式碼辨識不出來）
- [x] All mandatory sections completed

## Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers
- [x] Requirements testable and unambiguous
- [x] Success criteria measurable
- [x] Edge cases identified（`astNodeType` 撞名）
- [x] Scope clearly bounded（三項明確排除）
- [x] Assumptions identified

## Feature Readiness
- [x] All FRs have acceptance criteria
- [x] User scenarios cover primary flows

## Notes
🔄 **這份規格收回了上一則簡報的一句承諾**（「wasm 重新出貨」）——
`shipped-assets` 的判準是「有人真的去要它」，而沒有 Python target 就沒有人要。
**寫下來，不要讓它在收工時被悄悄忽略。**
