# Specification Quality Checklist: 學生看到的是代號，不是句子

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

輸入裡有 `broadcastOutput`、`RuntimeError`、`RUNTIME_ERR_UNDECLARED_VAR`、
`formatMessage`、`%1`／`{name}`、`execution-controller.ts:355` 等識別字，
照抄會讓 spec 變成一份 diff。

- **改法**：換成意圖——「把執行期停止原因推給使用者的地方」「停止原因是
  一個身分 ＋ 一組具名的值」「代號形狀的片段」。
- ⚠️ **而意圖沒有變弱**：FR-002「MUST 適用於**每一個**推給使用者的地方，
  MUST NOT 只修一處」比「改那三行」更難規避——後者可以改完三行，
  而第四個顯示點明天長出來。
- ⚠️ **一個例外是刻意留的**：FR-001 描述了代號的**形狀**
  （全大寫加底線、大括號、百分號數字）。那不是實作細節，是**判準**
  ——沒有它 FR-001 不可測。

### 第二輪：🔴 這條檢查最可能的死法原本只是 Edge Case

輸入把「不亂報」寫成一句話。而 `build-guardrail` 第 11 步逐字：
「**一條只會報、不會收的護欄，會把同一批項目報到人學會忽略它為止**
——而那時它報的新東西也一起被忽略了」。

**誤報不是小瑕疵，是這條檢查唯一的死法。** 它今天要掃的是
「使用者看得到的字串」，而程式裡到處都是開發期日誌——判準寬一格，
它就會報一整片，然後被人加進忽略清單。

- **改法**：升格成 **US2 場景 4**（開發期字串不得被報），
  並新增 **SC-002b**：誤報數 = 0，而判準是「說得出使用者在什麼情況下
  會看到那個字串」——**說不出來的即為誤報**。
- **理由**：與 `119`／`120`／`121` 同一個判準——只寫在 Edge Cases 裡的風險
  會被讀成「順便注意一下」，寫成場景才會有人為它寫測試。
- ⚠️ 而 SC-002b 的措辭刻意寫成**舉證責任在報的那一方**：
  預設不報，要報得說得出理由。

### 第三輪：⚠️ SC-002 會被一個「什麼都沒掃到」的檢查蒙混

SC-002「顯示代號的顯示點數 = 0」——🔴 一個掃描範圍為空的檢查
**也會回報 0**，而它與健康的檢查產出完全相同。

- **改法**：這一條由**兩個**東西夾住，而 spec 裡要看得出它們是一組：
  - **FR-007**（入口條件，錨在掃到的顯示點數量上）
  - **SC-003**（第一次跑必須是紅的——既有缺陷已實測存在，綠就是壞了）
- **依據**：`build-guardrail` 第 9 步逐字：「**計數器會數 ≠ 註冊表裡有東西。**
  基線是 0 的時候，這一步是唯一的健康檢查。」
  ——而本功能的基線**目標正是 0**，所以這一步不是可選的。
- ⚠️ 而 SC-003 的成立**依賴一個已實測的事實**（今天有 2 處會顯示代號）。
  spec 把它寫進 SC-001 的括號裡（「今天是 2」），
  **讓「第一次必須紅」有一個可查的根據，而不是一句期望**。

## Notes

- 三輪後全數通過。
- ⚠️ **留給 plan 的三個實質問題**（都有明確預設答案，不是 [NEEDS CLARIFICATION]）：
  1. **佔位符兩套並存還是統一？** 執行期文案用位置參數、診斷文案用具名參數，
     而查表函式只認具名的。⚠️ 統一要動兩份語言檔的既有文案，
     **而那是使用者看得見的字串**——成本要估。
  2. 🔴 **「顯示點」怎麼機械地認出來？** 這是整條檢查的成敗所在。
     ⚠️ `build-guardrail` 第 6 步：「靜態判斷不能下結論，只能排順序……
     要用靜態判斷，**先在已知答案的樣本上驗過**」
     ——判準要先餵兩個合成樣本（一個真的顯示點、一段開發期日誌），
     確認分得開才拿去掃全庫。
  3. **第二課教什麼？** spec 只要求「從第一課的成果走到一個新的會跑的程式」。
     ⚠️ 而 `124` 的第一課用了三個概念，**而選哪三個要說得出理由**
     ——同一個判準適用，且 plan 要說明第二課的概念**與第一課不重複**。
