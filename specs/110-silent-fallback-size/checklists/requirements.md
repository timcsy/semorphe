# Specification Quality Checklist: 靜默回退掩蓋辨識歧義

**Created**: 2026-08-10 ｜ **Feature**: [spec.md](../spec.md)

## Content Quality
- [x] No implementation details in requirements（需求層用「容器長度」「出聲」，不指名 API）
- [x] Focused on user value（迴圈一次都不跑，是學生看得到的）
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers
- [x] Requirements testable and unambiguous
- [x] Success criteria measurable / technology-agnostic
- [x] Acceptance scenarios defined
- [x] Edge cases identified（合法的 0、真空容器、其他容器）
- [x] Scope bounded
- [x] Dependencies and assumptions identified

## Feature Readiness
- [x] All FRs have acceptance criteria
- [x] User scenarios cover primary flows
- [x] No implementation details leak

## 本 spec 特有的門檻
- [x] **FR-004 反向**（真空容器仍回 0）已寫成需求——沒有它，「一律丟錯」也會通過 FR-003
- [x] **FR-006 判定要分兩類**——擋掉「把合法的 strcmp 也算成缺陷」讓數字虛高
- [x] **FR-007 照抄形狀**已寫成需求——上一輪換判準造成 strcat 回歸
- [x] **護欄只排順序不下結論**已寫進警告區並說明理由（合法與回退語法上相同）

## Notes
- 一次通過。
- 保留了兩次診斷錯誤的紀錄（探測過濾器濾掉答案）——判定為**必須保留**，
  因為它是「語料錯看起來像世界的性質」的新變形：**篩選條件也是語料的一部分**。
