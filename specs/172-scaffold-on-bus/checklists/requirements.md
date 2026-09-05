# Specification Quality Checklist: 骨架在積木那側上匯流排

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-06
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
      ⚠️ **判定**：spec 提到了現況的檔案與行號（`view-host.ts:104`、`app.ts:1757`）。
      那不是「怎麼實作」，是**這筆債今天躺在哪裡**——而少了它，
      讀的人無從確認這一刀真的存在。需求（FR）本身一個框架名都沒有。
- [x] Focused on user value and business needs
      ⚠️ 這一刀的使用者價值是**負的形式**：「外面看不出來」。
      所以 P1 的兩個 story 都寫成「沒有被弄壞」。
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
      🔴 唯一一個會需要拍板的（「邏輯搬不搬進事件處理器」）
      已由帶理由的預設解掉了，記在 A-001。
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable（SC-001 是硬性零，SC-002 是棘輪）
- [x] Success criteria are technology-agnostic
      ⚠️ SC-002 說的是「量表的方法呼叫數」，那是這個 repo 的既有量測機制，
      不是某個框架。
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
      🔴 其中一個是真的風險：**切換鷹架深度時樹沒有變**
      ——而事件那條路今天以「一次語義更新」為單位。
- [x] Scope is clearly bounded（Out of Scope 五條）
- [x] Dependencies and assumptions identified（A-001 ~ A-003）

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- 🔴 **最需要在 plan 階段解掉的一件事**：Edge case「切換鷹架深度」。
  它今天靠組裝點直接呼叫，而那正是這一刀要拆掉的那條路
  ——**所以它不是邊界情況，它是這一刀的主要難點**。
- ⚠️ **已知的雷**（US2）：`markScaffoldBlocks` 會動拖曳策略，
  而改成事件驅動會換掉呼叫時機。`app.ts:1757` 有一條註解記著它踩過。
