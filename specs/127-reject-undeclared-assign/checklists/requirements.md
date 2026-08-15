# Specification Quality Checklist: 指定給一個沒宣告的名字，必須停下來

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-15
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

輸入裡有 `Scope.set`、`scope.ts:52`、`this.variables.set`、
`RUNTIME_ERR_UNDECLARED_VAR`、`pointer_assign/execute.ts:30` 等識別字，
照抄會讓 spec 變成一份 diff。

- **改法**：換成意圖——「名字的可見範圍」「一層一層往外找的查找鏈」
  「指標指向的位置被寫入」。
- ⚠️ **而意圖沒有變弱**：FR-002「MUST 與『讀一個沒宣告的名字』用**同一則**訊息」
  比「沿用 `RUNTIME_ERRORS.UNDECLARED_VAR`」更難規避
  ——後者可以沿用常數而在顯示端組出不同的話。
- ⚠️ 而 Key Entities 保留了一句**行為描述**（讀找不到就拒絕／寫找不到就建立），
  因為**那個不對稱就是整個功能**——拿掉它 spec 會失去它的主題。

### 第二輪：🔴 「爆炸半徑只有 1」原本是一個前提，而它應該是一條驗收

輸入把「實測只有 1 支失敗」寫成已知事實。**而那是量測，不是保證**
——`build-guardrail` 第 6 步逐字：「靜態判斷不能下結論，只能排順序」，
而這裡的量測是動態的但**只跑過一次**。

- **改法**：升格成 **SC-002**：「因本功能而失敗的既有驗證數 **= 1**，
  而**那一支必須是斷言此缺陷的那一支**」，
  並加上⚠️「**若大於 1，代表這個修法比量到的貴——停下來重新評估，不要硬修**」。
- **理由**：🔴 一個寫成前提的數字，在它變了的時候**沒有任何東西會擋**；
  寫成驗收才會。而這個功能的整個賣點就是「它很便宜」
  ——**便宜本身必須是可否證的**。

### 第三輪：⚠️ SC-001 會被一個「什麼都拒絕」的實作蒙混

SC-001「沒宣告就指定的程式，跑完比例從 1/1 降到 0/1」
——🔴 一個**把所有指定都拒絕**的實作也達成它，而那會毀掉整個系統。

- **改法**：這一條由**三個**東西夾住，而 spec 裡看得出它們是一組：
  - **US1 場景 3**（正常宣告過的程式一切照舊）
  - **FR-003**（外層可見範圍宣告過 MUST 放行）＋ Edge Cases 第一條
  - **SC-003**（55 段真實情境程式的通過數**不變**）
- **依據**：`build-guardrail` 第 9 步的兩個方向——
  「故意壞掉的輸入**會報**」與「**正確的輸入不亂報**」，
  **第二個不可省**。而 SC-003 是這裡的「不亂報」。
- ⚠️ 而 Edge Cases 特別點名了**作用域**：`experience` 記過
  「一個作用域少了，症狀不是『變數不見』而是『變數活太久』」
  ——這一輪反過來，症狀會是「**變數死太早**」。

## Notes

- 三輪後全數通過。
- ⚠️ **留給 plan 的三個實質問題**（都有明確預設答案，不是 [NEEDS CLARIFICATION]）：
  1. 🔴 **指標寫入那條路徑要不要一起改？** FR-006 只要求「單獨驗並寫下結論」。
     ⚠️ 而 `build-guardrail` 記過「共用一個症狀不代表共用一個根因……
     宣稱『這 N 筆是同一個根因』之前，在其中至少兩筆上分別驗過」
     ——**它與主路徑長得一樣，而那正是不能一起改的理由**。
  2. **查找鏈今天用例外當控制流**（往上找時靠「抓到例外就當作沒有」）。
     ⚠️ 改成拒絕之後，那個 catch 會**吞掉真正的錯誤**——
     這是本功能最可能默默壞掉的地方，plan 要處理。
  3. **第二課改哪一段？** 今天課文在「第四步」用一句 ⚠️ 帶過
     「這一行沒有 `int`，因為已經開過了」。而修好之後，
     **可以讓學生真的試一次「不加 `int` 開新名字」**——
     ⚠️ 而那會多一個步驟，**三個概念的上限要重新確認**。
