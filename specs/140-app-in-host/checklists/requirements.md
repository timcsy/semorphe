# Specification Quality Checklist：擴充裡跑的就是網頁版本身

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-18
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
  - 🔴 **這一份比前兩份更難守，因為它談的就是介面元件**。逐條清過：
    規格裡**沒有**出現 `MonacoPanel`／`BlocklyPanel`／`App`／`app-shell`／
    `StorageService`／`CodeView`／`postMessage`／`localStorage`／Webview。
  - 用的是**角色名**：「程式碼視圖」「存檔服務」「面板組裝」
    ——而 Key Entities 明說「應用只認識這個角色，不認識任何一個具體的編輯器」。
  - ⚠️ **兩處例外**：`history/072` 與 `app.ts` 的還原路徑
    ——那是**病歷出處**，不是做法。
- [x] Focused on user value and business needs（五個故事全部從學生出發）
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
  - 🟢 唯一的大決定（(a) 抽成可抽換的角色 vs (b) 另組一份）
    **在寫規格之前由使用者拍板**。
- [x] Requirements are testable and unambiguous（9 條 FR）
- [x] Success criteria are measurable（8 條）
  - ⚠️ **SC-001 是「人看得出是同一個產品」——它可驗但不可自動化**，
    而規格**明說了那一條由使用者判斷**。
- [x] Success criteria are technology-agnostic
- [x] All acceptance scenarios are defined（5 個故事）
- [x] Edge cases are identified（6 個）
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

### 🔴 這一份規格存在的理由，是上一份的一個結構性缺陷

spec 139 的驗收**全部是可量測的數字**（跨距中位數、零個等待、
基線零變動…），而它們**全部達成了**。

⚠️ **而使用者拿到的東西不是他要的。**

> **一份把「怎麼證明它對」寫得很好的規格，
> 可以完全不描述「它該長什麼樣」。**

🔴 **所以本份的第一條驗收刻意是不可自動化的**：
「並排截圖，人看得出是同一個產品」。

而那條的配套是**交付物要附截圖**——
⚠️ **不是我描述它有多像**。一個把「像不像」換成「有幾個區塊」的驗收，
**已經不是同一條驗收了**（SC-002 存在，但它不能取代 SC-001）。

### ⚠️ 第二件不尋常的：FR-006 禁止「長得一樣而沒作用」

> 「在這個宿主裡沒有意義的控制項 MUST 不出現，MUST NOT 出現而無作用。」

**一個長得一樣而按下去沒反應的按鈕，比沒有那顆按鈕更糟**
——因為它讓「像」變成一個謊。

### 🔴 第三：US3 是唯一一條「做錯了會毀損使用者資料」的

網頁版開機時會從自己的存檔還原程式碼。在 IDE 裡**檔案才是真相**，
而還原會**用舊內容蓋掉它**。

⚠️ 那不是理論風險：那條路徑今天就在，而它會在第一次打開面板時執行。
**所以 FR-004 要有一支測試釘住，不能只靠「記得不要」。**
