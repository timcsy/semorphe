---

description: "Task list for 051-lift-claim-arbitration"
---

# Tasks: 讓「誰認領這段語法」不再靠運氣

**Input**: Design documents from `/specs/051-lift-claim-arbitration/`

**Tests**: 憲章 II 全程適用。護欄本身即測試；**判定邏輯另有單元測試**——誤報風險集中在那裡（與 049 的掃描規則同理）。

**Organization**: 依 User Story 分組。

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 執行 `npm test` 確認起點乾淨，記下前四項量測數字作為零行為改動的回歸基準

---

## Phase 2: Foundational — 判別式與互斥判定

**Purpose**: 本功能唯一有實質邏輯的部分。**誤報風險全集中在這裡**，所以它先做且有自己的測試。

- [X] T002 在 `tests/helpers/discriminator.ts` 實作 `extractDiscriminators(rule)`：從 `constraints[]` 萃取 `field:<名>` 維度
- [X] T003 在同檔擴充：**`chain` 型的判別式**（`chain:operator`、`chain:rootText`）——research F2，漏掉會誤報 `print`／`input`
- [X] T004 在同檔擴充：`operatorDispatch` 與 `composite` 型的判別式
- [X] T005 在同檔實作 `provablyDisjoint(a, b)`：exact/exact 值不同、nodeType/nodeType 值不同、exact/prefix 不符前綴、prefix/prefix 互不為前綴 → 互斥；其餘判不出來
- [X] T006 在同檔實作 `classifyPair(ruleA, ruleB)` 三分類：可證互斥 → `never`；雙方判別式皆空 → `definitely`；其餘 → `unknown`
- [X] T007 在 `tests/unit/helpers/discriminator.test.ts` 為判定邏輯寫單元測試：**`print` vs `input` 必須判 `never`**（chain 的運算子與根文字不同）、兩條無限定條件的規則必須判 `definitely`、不同 field 的限定條件必須判 `unknown`（不得樂觀歸入 `never`）

**Checkpoint**: T007 綠 → 判定可信

---

## Phase 3: User Story 1 — 歧義變得看得見（P1）🎯 MVP

- [X] T008 [US1] 在 `tests/integration/audit-lift-ambiguity.test.ts` 寫斷言骨架（**此時應紅**：基線缺失）
- [X] T009 [US1] 實作量測：從測試載入路徑取得載入後的規則表，列出所有「同語法同優先權」群組
- [X] T010 [US1] 每組標明目前勝出者，以及**勝出原因是「優先權較高」還是「只是登記得早」**（FR-003）
- [X] T011 [US1] 實作報表：群組明細 ＋ 四個數字
- [X] T012 [US1] 產生 `tests/baselines/lift-ambiguity.json`，確認 `samePriorityGroups` 為正數後 commit
- [X] T013 [US1] 驗證棘輪：新增一條同語法同優先權的規則 → 護欄失敗且**指名是哪一組** → 還原後通過

---

## Phase 4: User Story 2 — 靠運氣的部分被標出來（P1）

- [X] T014 [US2] 在護欄中對每組的每一對規則套用 `classifyPair`，產生三分類
- [X] T015 [US2] 報表**分別**呈現三個數字，且「無法確定」**自成一類**——不併入任何一邊（FR-011）
- [X] T016 [US2] 實作重複登記偵測：同一概念在同一語法上出現一次以上（FR-013、research F4）
- [X] T017 [US2] 報表呈現**差集**：「同優先權但不會撞」＝優先權設了沒作用；「不同優先權但會撞」＝優先權在做隱形仲裁（後者更危險）
- [X] T018 [US2] 四個數字各自成為只准下降的棘輪，**含 `unknown`**（D5）

---

## Phase 5: User Story 3 — 護欄自己不會安靜地量錯（P2）

- [X] T019 [US3] 報表開頭固定印出自我否證聲明：「**如果 `declaration` 那 8 條沒有出現在確定會撞裡，代表本護欄壞了**」（FR-020）
- [X] T020 [US3] 報表聲明本護欄**不檢測**什麼：跨語法節點的間接競爭、手寫辨識層、執行期才成立的條件（FR-021）
- [X] T021 [US3] 寫一支測試釘住已知案例：`declaration` 那 8 條**必須**出現在「確定會撞」（FR-022）——漏報它就是護欄壞了
- [X] T022 [US3] 報表說明「數字下降 ≠ 修好 bug」——它移除的是**未來會咬人的機會**（plan 末尾的判斷）

---

## Phase 6: Polish

- [X] T023 依 `quickstart.md` 七情境驗收，特別是情境 2（已知案例必然出現）與情境 3（不誤報 `print`／`input`）
- [X] T024 確認 `src/` **零改動**、前四項量測數字皆未上升、既有測試全綠
- [X] T025 更新 `knowledge/vision.md` 階段 6.5：勾選 P1 並填入實測基線
- [X] T026 更新 `knowledge/draft/2026-08-05-元件膠囊重構.md`：把 P1 的描述換成實測結果，記錄 research F2（判別式不只在限定條件裡）

---

## Dependencies

```
T001 → Phase 2（T002–T007，阻斷全部）→ US1 / US2 / US3 → Polish
```

US2 需要 Phase 2 的 `classifyPair`；US1 只需要規則表。US3 需要 US2 的分類結果。

## Implementation Strategy

**MVP = US1**——單獨做完就能列出 8 個群組與勝出原因，那已經是「目前完全無法回答」的問題的答案。

**建議順序**：Setup → Foundational（判定邏輯，誤報風險集中處）→ US1 → US2 → US3 → Polish。

## Notes

- **`src/` 零改動是硬性約束**（T024 專門驗）。
- **判別式萃取漏一層就會誤報最常用的規則**——T003 是本功能最容易做錯的一步。
- **本護欄第一天不是零**，8 個群組已知存在。要求它綠等於沒有量。
