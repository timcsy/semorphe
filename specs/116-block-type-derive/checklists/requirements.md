# Specification Quality Checklist: 積木型別從概念身分導出

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-11
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

### 第一次驗證發現並已修的三項

1. **「無實作細節」一開始不過。** 初稿的 FR 直接寫了檔名與函式名
   （`storage-version.ts` 的 upgrade 函式、`id-migrations.ts`）。
   已改成描述**性質**（「凍結的明表」「一次性轉換」「載入時的主要還原來源」），
   檔名只留在文件開頭「規劃時查證的三件事」那一節——那是**證據**，不是需求。

2. **驗收數字自相矛盾。** 使用者輸入寫「86 → 0」，而重量之後嚴格判準是 153。
   兩個數字都對，量的不是同一件事。已在 spec 最前面用一張表寫清楚，
   並據此把 67（只差前綴）與 86（化石詞彙）拆成**兩個使用者故事**——
   因為它們的風險與性質不同。

   > 若不先寫清楚，護欄第一次跑會報 153 而規格說 86，
   > 而讀的人會以為護欄壞了。

3. **多形態的邊界情況原本漏了。** 同一顆身分可以有多個積木形態，
   而導出規則會讓它們的名字相同。已補成 FR-010 與一則 Edge Case。

### 仍然存在的風險（不是規格缺陷，是實作要面對的）

- **「只有兩個存檔管道」是假設，不是查證過的事實**（已寫進 Assumptions）。
  這一條若不成立，遷移會漏——實作的第一步應該是驗證它。
- **86 筆化石裡若有一筆是刻意的差異**，那是發現不是障礙（已寫進 Assumptions）。
