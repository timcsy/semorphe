# Specification Quality Checklist: 元件詞彙統一

**Created**: 2026-08-20 · **Feature**: [spec.md](../spec.md)

## Content Quality
- [x] No implementation details
- [x] Focused on user value（硬體要加進來，而協定的詞彙要涵蓋兩邊）
- [x] All mandatory sections completed

## Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers
- [x] Requirements testable（`grep` ＝ 0、基線 diff ＝ 空）
- [x] Edge cases identified（知識庫的日常語義、specs 是病歷）
- [x] Scope bounded（五項明確排除）

## Feature Readiness
- [x] FR-007 把「不得順手改根公理」寫成硬性要求，而不是備註

## Notes
🔴 **這份規格最重要的一條是 FR-006**（基線數字不得改變）。
spec 140 有過相反的病歷：改名讓護欄報「改善了 73 → 51」，而那是假的。
**任何一個數字動了，都要當成發現去查，不是調基線。**
