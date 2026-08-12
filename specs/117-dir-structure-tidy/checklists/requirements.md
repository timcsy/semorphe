# Specification Quality Checklist: 目錄結構的四件小整理

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-12
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
      ⚠️ **本規格是例外且刻意的**：它的主題**就是**檔案位置，
      所以路徑名不可避免。而它仍然不談「怎麼移動」（腳本／IDE／git mv）。
- [x] Focused on user value and business needs
      使用者價值是「新來的人打開資料夾看到預期的東西」＋「2D 面板有乾淨的位置」
- [x] Written for non-technical stakeholders
      ⚠️ 部分——這是一個結構重構，讀者實際上是開發者。已在每個 User Story
      寫出「為什麼是這個優先級」而不只是「做什麼」。
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
      兩個原本可能需要澄清的（新名字、`universal.ts` 去處）已寫成 Assumptions
      並標明「若被否決會怎樣」
- [x] Requirements are testable and unambiguous
      FR-005（凍結明表逐字不變）用 `git diff` 可機械驗證
- [x] Success criteria are measurable
      SC-001～SC-007 全部是數字或綠／紅
- [x] Success criteria are technology-agnostic
      ⚠️ **部分不是**（`tsc`／`npm test`）——而本規格的主題是原始碼結構，
      那些命令就是使用者（開發者）的驗收動作，不是實作細節
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
      四個，其中「凍結明表被順手整理」是最高風險
- [x] Scope is clearly bounded
      三項明確排除，各有理由
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

⚠️ **兩處刻意偏離模板，理由寫在上面**：本規格的主題是原始碼結構，
所以「不談技術細節」與「技術中立的驗收」兩條無法完全滿足。
**而偏離的部分被限縮在「位置與驗收命令」，不含「怎麼做」**——
那留給 `plan.md` 與 `tasks.md`。

**最高風險**：FR-005。合併凍結明表時最自然的動作（排序、去重、統一格式）
正是被禁止的動作。`tasks.md` 必須把「驗證內容 diff = 0」排成一個獨立步驟，
而不是附在合併那一步的尾巴。
