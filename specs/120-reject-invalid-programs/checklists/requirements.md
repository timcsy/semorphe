# Specification Quality Checklist: 寫錯的程式不該跑得起來

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

## 驗證過程的記錄（三輪，每一輪都有實質修正）

### 第一輪：🔴 實作細節洩漏

輸入裡有大量識別字（`onlyInterpreterRuns`、`degradationCause`、
`unknownConceptHandler`、`'abort'`、`source: 'component'`），照抄會讓 spec
變成實作清單。

- **改法**：換成意圖——「只有本系統跑得動、參照工具跑不動」「使用者造成的語法錯誤」
  「來源標記為元件宣告」。
- ⚠️ **而意圖沒有變弱**：FR-002 說的「**兩類必須是分開的數字**」
  比「加一個 `illegalProgram` 欄位」更難規避——後者可以加了欄位而永遠是 0。

### 第二輪：🔴 最大的風險原本不是一個故事

輸入把「編輯時不拒絕」寫成驗收第 4 條。而**那是這個功能最可能毀掉工具的地方**：
一個每次按鍵就跳「語法錯誤、無法執行」的編輯器沒有人用得下去。

- **改法**：升格成 **User Story 3（P1）**，有自己的獨立測試與兩條場景，
  並在 SC-004 標為「防止工具變得不能用的那道閘」。
- **理由**：與 `119` 的 US3 同一個判準——只寫在成功標準裡的風險，
  實作時會被讀成「順便確認一下」；寫成 User Story 才會有人為它寫測試。

### 第三輪：⚠️ US1 可能推翻 US2／US4，而 spec 原本沒說會怎樣

輸入寫了「若那一欄是 0，②③ 的前提要重看」，而那句話沒有落點。

- **改法**：寫進 **SC-002**，並明說「**而如果它是 0，US2／US4 的前提要重看並記錄**」
  ——讓整個功能**可否證**，而不是「量完就繼續照原計畫做」。
- ⚠️ 這是 `knowledge/history/057` 那條的直接套用：
  **先量再修，而量出來的結果要真的有權力改變後面的計畫。**

## Notes

- 三輪後全數通過。
- ⚠️ **留給 plan 的三個實質問題**（都有明確預設答案，不是 [NEEDS CLARIFICATION]）：
  1. 「按執行時判定」——那個判定放在**哪一層**？UI 的執行入口、還是直譯器自己？
     ⚠️ 兩者的差別是「積木側會不會一起被擋」。
  2. US4 的「方法屬於哪些型別」宣告在**哪裡**？元件的 manifest 已經有
     宣告接點型別的欄位，但它說的是節點種類不是值型別——是擴那個欄位還是另開一格？
  3. US1 的分類判準怎麼寫？「工具跑不動」與「程式不合法」的界線
     要能從失敗訊息機械地分出來，⚠️ 而那個判準本身可能需要在已知答案的樣本上驗過
     （`build-guardrail` 第 6 步）。
