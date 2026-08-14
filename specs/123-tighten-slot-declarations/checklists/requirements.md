# Specification Quality Checklist: 兩筆宣告與現實不符

**Created**: 2026-08-14 | **Feature**: [spec.md](../spec.md)

## Content Quality
- [X] No implementation details
- [X] Focused on user value
- [X] Written for non-technical stakeholders
- [X] All mandatory sections completed

## Requirement Completeness
- [X] No [NEEDS CLARIFICATION] markers
- [X] Requirements testable and unambiguous
- [X] Success criteria measurable
- [X] Success criteria technology-agnostic
- [X] All acceptance scenarios defined
- [X] Edge cases identified
- [X] Scope clearly bounded
- [X] Dependencies and assumptions identified

## Feature Readiness
- [X] All FRs have acceptance criteria
- [X] User scenarios cover primary flows
- [X] Feature meets measurable outcomes
- [X] No implementation details leak

## 驗證過程（三輪）

### 第一輪：🔴 這個 spec 本身踩在一條紅線上

`build-guardrail` 逐字：「**用宣告刷數字看起來會像進步**」。
而本功能**就是刪宣告讓數字下降**——從外面看與刷數字**一模一樣**。

- **改法**：加一整節「⚠️ 而這不是用宣告刷數字」，把差別寫成**可檢查的**：
  **刷數字沒有出處，本功能每一筆都要附產生端／消費端的出處**（FR-002）。
- ⚠️ 而 FR-004 要求那筆下降**標成「宣告與現實不符」而非「實作了」**
  ——**兩種下降分開記**，這樣未來的人讀得出差別。

### 第二輪：🔴 缺一個「如果我判斷錯了會怎樣」的閘

若那條路**其實有人走**，刪掉宣告就是**製造**一個資料遺失。

- **改法**：升格成 **US2（P1）**——移除前後，來回轉換與執行的結果**逐字相同**。
  ⚠️ 而這個專案**有現成的對照組**（`declaration-change-parity`，
  上一輪剛因為一次**刻意的**行為改變而更新過）。

### 第三輪：⚠️ 我原本的推測是「幾筆是假的」，而查證是 1～2 筆

- **改法**：Out of Scope 明寫「**其餘 9 筆是真的**」並附理由
  （數字字面在那些位置是合理的運算式）。
- **理由**：一個把範圍說得比查證大的 spec，會讓下一個人以為那 9 筆也可疑。

## Notes

- ⚠️ **留給 plan 的一個問題**：`var_declare` 的產生器**還讀著** `declarators`
  （`generate.ts:11`）。移除宣告之後那個分支變成死程式碼——
  **一併刪還是留著？** FR-005 要求至少記下來。
