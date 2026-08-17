# Specification Quality Checklist: 目標（target）

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-17
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

## 驗證過程的記錄（三輪，每一輪都有實質修正）

### 第一輪：🔴 實作細節洩漏

輸入裡有 `levelTree`、`io_style`、`namespace_style`、`c.json`、
`<stdbool.h>`、`struct Point p;`、`gcc -std=c99`、`sync-controller.ts:21`
等識別字，照抄會讓 spec 變成一份修改清單。

- **改法**：換成意圖——「可見範圍」「產出風格」「一個關鍵字所需的標頭名在
  兩個世界不同」「一種型別宣告需要額外標籤」。
- ⚠️ **而意圖沒有變弱**：FR-008 說的是「**一整族**，不是特例」，
  比「加 10 筆對映」更難規避——後者可以加了 10 筆而第 11 筆照樣漏。

### 第二輪：🔴 「不新增機制」原本只是一句話

輸入把「不新增任何機制」寫在範圍裡。而**那是這個功能最容易在實作時
被違反的地方**：一個「順手多加一個欄位」就會讓目標從**組合**變成**新層**。

⚠️ 而這個專案有前例：「機制有了沒人接上」發生過**五次**。

- **改法**：升格成 **User Story 2（P1）**，兩條場景
  （每個欄位對應到既有的東西／新增數為 0），
  並在 **SC-005** 給一個**可操作的判準**：
  「目標的每一個欄位都說得出**它今天住在哪裡**——說不出來的即為新機制」。
- **理由**：與 `119`／`120`／`126` 同一條——只寫在範圍裡的約束會被讀成
  「注意一下」，寫成 User Story 才會有人為它寫測試。

### 第三輪：⚠️ SC-002 會被一個「亂加標頭」的實作蒙混

SC-002「C 產出編得過 6/10 → 10/10」——🔴 一個**把兩個世界的標頭全部都加**
的實作也會達成它，而那產出的是垃圾。

- **改法**：由**三個**東西夾住，而 spec 裡看得出它們是一組：
  - **US3 場景 3**（C 產出的 C++ 專屬寫法**仍為零**，不得退步）
  - **US3 場景 2**（C++ 那一側**不得**因為修 C 而弄壞）
  - **Edge Cases**：🔴「**編得過的漏網最危險，因為測不出來**」
    ——某些編譯器兩種標頭都吃
- **依據**：`build-guardrail` 第 9 步的兩個方向
  ——「會報」與「**不亂報**」，而第二個不可省。

## Notes

- 三輪後全數通過。
- ⚠️ **留給 plan 的三個實質問題**（都有明確預設答案，不是 [NEEDS CLARIFICATION]）：
  1. 🔴 **目標住在哪一層？** 它綁的是課程清單（core 的概念）與風格（語言套件的東西）。
     ⚠️ 而中立性護欄的射程含 `src/core`——**目標若住在核心，它會認識 C 這個名字**。
     那條護欄的基線是 `total: 0`，**而預期是「不動」，所以放錯層會當場變紅**。
  2. **標頭名對映表放哪、幾筆？** spec 說「約 10 筆」而**那是估的**——
     ⚠️ plan 要**數出真正的數量**，而 `build-guardrail` 記過
     「一叢違規看起來像一個根因，而那是假設不是結論」。
  3. **「切換不改語義樹」怎麼驗？** 逐節點比對需要一個穩定的序列化。
     ⚠️ 而這個專案有現成的做法（roundtrip 測試），plan 要指出是哪一個，
     **不要發明第二種**。
