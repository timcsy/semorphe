---

description: "Task list for 053-declare-noop-execute"
---

# Tasks: 讓「刻意不執行」說得出話

**Input**: Design documents from `/specs/053-declare-noop-execute/`

**Prerequisites**: plan.md、spec.md、research.md、data-model.md、contracts/、quickstart.md

**Tests**: 憲章 II（TDD 非妥協）全程適用。**分類在測完之前不得寫下。**

**Organization**: 依 User Story 分組。

## Format: `[ID] [P?] [Story] Description`

- **[P]**：可平行（不同檔、無未完成相依）
- **[Story]**：US1、US1b、US2、US3、US4

---

## Phase 1: Setup 與**分類的實測地基**

> ⚠️ **T002 是這個功能最重要的一個任務，而且它必須在任何分類之前完成。**
>
> research F2b 已經現形過一次：靜態掃描的分類答案是**反的**。抓到它的是先做的實測與它矛盾。**先跑，再分類。**

- [X] T001 執行 `npm test` 確認全綠，記下六項量測作為回歸基準
- [X] T002 建立 `tests/integration/noop-classification.test.ts`：為那份清單裡**每一個**概念寫一支最小 C++ 程式與**人工寫定的期望輸出**，跑直譯器、印出 34 列的表（程式碼／期望／實得／是否相符）
  > 這一步**只量不判**。表印出來之後才進 T003。
- [X] T003 依 T002 的實測結果分類，寫入 `specs/053-declare-noop-execute/classification.md`：每一列註明判定（`declarative`／`consumed-by-parent`／`還沒實作`）與**依據**（實測輸出，不是意見）
  > **若 34 個全部通過**：停下來，回頭看最小程式是不是太簡單（quickstart 情境 0）。**那不是好消息。**
- [X] T004 在 `classification.md` 標出 3 個死條目（`cpp:include`／`cpp:include_local`／`cpp:using_namespace`，概念註冊表裡不存在）

**Checkpoint**: 分類有實測依據 → 後續 Story 可開工

---

## Phase 2: User Story 1b — 被關掉的四個轉型恢復正確（Priority: P1）🎯 唯一讓使用者現在受益的

**Goal**: `static_cast<int>(3.9)` 得到 3。

**Independent Test**: 單獨跑 `cast-operators.test.ts`。

### 先紅

- [X] T005 [US1b] 建立 `tests/integration/cast-operators.test.ts`：四個轉型各一支最小程式，斷言正確輸出（**此時應紅**——`static_cast` 給 0）
- [X] T006 [US1b] 加一支測試證明**覆蓋確實發生**：檢查同一概念在註冊過程中被寫入超過一次（research F8 的推理要跑出來，不是讀出來）
  > 跑不出來 → 代表覆蓋來源不只 F8 找到的那一處，**先查清楚再改**

### 後綠

- [X] T007 [US1b] 從 `src/interpreter/interpreter.ts` 的清單移除那四個轉型概念——**修法是刪四行，不是新寫實作**（實作一直在 `functions.ts`）
- [X] T008 [US1b] 確認 `operators.ts:133` 那個轉型迴圈與 `functions.ts` 的註冊**不互相覆蓋**；只留一處（FR-016）

**Checkpoint**: T005 全綠 → US1b 可獨立交付。**這是 MVP。**

---

## Phase 3: User Story 1 — 說不出理由的不准宣告（Priority: P1）

**Goal**: 只有 T003 判定可宣告的概念拿到宣告；其餘仍算殼並進缺陷帳。

- [X] T009 [US1] 在 `src/core/types.ts` 新增 `SkipReason = 'declarative' | 'consumed-by-parent'` 與 `skipReasons?: Partial<Record<PathName, SkipReason>>`，並**改寫 `skipPaths` 的型別註解**——它不再是「不影響執行期行為」的純資料
- [X] T010 [US1] 加一支測試強制：有 `skipPaths` 必有對應 `skipReasons`（**沒有理由的宣告是把缺陷洗成設計**）
- [X] T011 [US1] 加一支測試強制：宣告 `execute` 被跳過的概念，**不得**同時註冊非空執行器（矛盾偵測，FR-012）
- [X] T012 [US1] 依 T003 的分類，把可宣告的概念加上 `skipPaths: ["execute"]` + `skipReasons`（改 `concepts.json`；通用概念如 `comment` 放通用層）
- [X] T013 [US1] 確認判為「還沒實作」的概念**沒有**拿到宣告，且仍出現在完備性報表的殼裡（FR-003）
- [X] T014 [US1] 把判為「還沒實作」的概念登記進缺陷帳，標記為**執行結果可能錯誤**（FR-004／FR-005）
  > **實作偏離**：原訂寫進缺陷帳，但缺陷帳掃的是停用測試——那等於新增 15 個 `it.todo`，而 050 剛學到那正是噪音（「只有名字的測試」需要的是重新產生，不是修缺口）。改為：它們已被完備性報表算成殼，且 `noop-classification.test.ts` 每次跑都把 14 列印出來。**不沉默，比 todo 好。**

**Checkpoint**: 宣告有依據、缺陷仍可見 → US1 可獨立交付

---

## Phase 4: User Story 2 — 清單消失，宣告接手（Priority: P1）

**Goal**: 核心層不再持有語言專屬概念名。

### 先紅

- [X] T015 [US2] 加一支測試：對每個被宣告的概念，執行行為與**修改前逐一比對相同**（跳過、不報錯）
- [X] T016 [US2] 加一支測試：既無宣告也無執行器的概念仍回報未知概念（現況，不得改變）

### 後綠

- [X] T017 [US2] 在 `src/interpreter/interpreter.ts` 刪除 34 個概念名的清單，改為走訪概念註冊表：`skipPaths` 含 `execute` 者註冊 noop（data-model 契約 3）
- [X] T018 [US2] 確認直譯器建構時取得概念註冊表的方式**不引入對語言套件的 import**（否則違反的是同一條 P9）
- [X] T019 [US2] 執行中立性護欄，確認 `interpreter.ts` 的違規數下降，並記錄下降幅度可歸因到哪些概念（FR-030）

**Checkpoint**: 清單歸零、行為不變 → US2 可獨立交付

---

## Phase 5: User Story 3 — 除錯步驟改用語義標註（Priority: P2）

- [X] T020 [US3] 加一支測試：除錯逐步執行停下來的位置，與修改前**完全相同**（**此時應綠**，用來當回歸基準）
  > ⚠️ **實作時漏了這一步**，直接跳去 T021/T022，所以沒有事前基準。結果是靠既有的兩支步驟測試失敗才發現接線缺口（universal 概念的標註沒人推送），而不是靠基準比對。**它們碰巧存在，所以這次沒出事**——若那兩支不存在，除錯步驟會靜靜地全部消失。TDD 的順序不是形式。
- [X] T021 [US3] 在相關概念的 `concepts.json` 加 `annotations: { "debug_step": true }`
- [X] T022 [US3] 在 `src/interpreter/interpreter.ts` 刪除 `statementConcepts` 清單，改讀標註；**缺標註預設不停**（與現況一致）
- [X] T023 [US3] 重跑 T020 確認位置未變

**Checkpoint**: 第二份清單歸零 → US3 可獨立交付

---

## Phase 6: User Story 4 — 以後不會退回寫死清單（Priority: P2）

- [ ] T024 [US4] 在 `src/interpreter/executor-registry.ts` 加 `duplicates()`：記錄同一概念被註冊超過一次的情形。**不在註冊時報錯**（`history/017`：加嚴之前先回答「被拒絕的東西去哪了」，這裡答案是「不知道」）
- [ ] T025 [US4] 建立 `tests/baselines/executor-duplicates.json` 與對應棘輪；**獨立 commit**
- [ ] T026 [US4] 改 `tests/integration/audit-completeness.test.ts` 的報表為三欄：實作／已宣告不提供（附理由）／殼。**棘輪只看殼與缺**（FR-031）
- [ ] T027 [US4] 報表列出每個宣告的理由，讓宣告可被複查而不是一次性的（FR-032）
- [ ] T028 [US4] 加自我否證聲明：「如果分類跑出 34 個全部可宣告，代表判準太鬆或最小程式太簡單——**那不是好消息，是工具壞了**」

**Checkpoint**: 兩種下降分得出來 → US4 可獨立交付

---

## Phase 7: Polish & Cross-Cutting

- [ ] T029 依 `quickstart.md` 八個情境逐一驗收，**特別是情境 0**
- [ ] T030 下調 `tests/baselines/completeness.json` 與 `neutrality.json`；**獨立 commit，訊息說明下降的來源是宣告還是實作**
- [ ] T031 確認其餘四項量測未上升
- [ ] T032 執行 `npm test` 確認全綠
- [ ] T033 更新 `knowledge/concepts/執行機構.md`：第一條判準「讓正確的那個說話」第一次真的被落實，補上實測結果
- [ ] T034 更新 `knowledge/vision.md`：階段 6.5 記錄中立性與完備性的**第一次下降**，並註明多少來自宣告、多少來自實作
- [ ] T035 回填 `knowledge/experience.md`——**只在真的有新東西時才寫**。候選：「判準是對的，把它自動化的第一版仍然會量錯」（F2b，第五個實例、新觸發點：兩個量測互相矛盾）

---

## Dependencies

```
Phase 1 (T001–T004 實測分類)   ← 阻斷所有分類決定
    ↓
    ├─→ US1b 四個轉型 (T005–T008)   ← MVP，唯一使用者現在受益
    ├─→ US1  宣告的門檻 (T009–T014)  ← 需 T003 的分類
    └─→ US3  除錯標註   (T020–T023)  ← 與其餘無關，可先做
              ↓
        US2 清單消失 (T015–T019)     ← 需 US1 的宣告先就位
              ↓
        US4 護欄     (T024–T028)     ← 需前面行為定案才量得準
              ↓
        Phase 7 Polish (T029–T035)
```

**US1b 與 US3 完全獨立**，可先做。**US2 必須在 US1 之後**——清單刪掉之前，宣告要先接上，否則被宣告的概念會變成未知概念。

## Parallel Opportunities

```
US1b: src/interpreter/interpreter.ts（刪四行）+ tests/integration/cast-operators.test.ts
US3:  concepts.json + interpreter.ts（statementConcepts）
US1:  src/core/types.ts + 各 concepts.json
```

⚠️ US1b／US2／US3 都碰 `interpreter.ts`，**實際上要序列化**。

## Implementation Strategy

**MVP = US1b**。四個轉型恢復正確是整個功能裡唯一讓使用者現在就受益的——學生寫 `static_cast<int>(3.9)` 會得到 3 而不是 0。其餘都是「以後不會出事」與「我們對系統的認識」。

**建議順序**：

1. **T001–T004** → 實測分類（**不先做這個，後面全是猜的**）
2. **US1b**（T005–T008）→ **MVP，可停在這裡**
3. **US1**（T009–T014）→ 宣告的門檻
4. **US2**（T015–T019）→ 清單消失
5. **US3**（T020–T023）→ 第二份清單
6. **US4**（T024–T028）→ 護欄
7. **Polish**（T029–T035）

**Git 紀律**：每個 Story 一組 commit；T025 與 T030 的基線**獨立 commit**。

## Notes

- **T002 只量不判。** 把量測與判斷分成兩個任務，是因為 F2b 的錯正是「一邊掃一邊下結論」。
- **T003 若跑出「全部可宣告」要停下來。** 最省事的結果同時是最可疑的結果。
- **T007 的修法是刪四行**，不是新寫實作。看到 `static_cast` 壞掉就想動手寫轉型邏輯，會寫出第五處註冊。
- **T017 之前 T012 必須完成。** 順序反了的話，被宣告的概念會在清單刪除後變成未知概念，使用者的程式會整個停掉——那正是 `history/017` 講的形狀。
- **T035 允許不寫。** 沒有新教訓時硬寫一條是稀釋。
