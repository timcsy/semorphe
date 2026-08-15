# Tasks: 指定給一個沒宣告的名字，必須停下來

**Input**: [plan.md](plan.md)、[research.md](research.md)、[spec.md](spec.md)

**Tests**: 要求——US1 的驗證必須是**行為端**（跑一段程式），不是單元端。

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [ ] T001 確認分支 `127-reject-undeclared-assign`、記下基準：
      `npm test` 4168、護欄 44、e2e 19、基線檔 33

---

## Phase 2: Foundational

- [ ] T002 把 `tests/probes/__q3.test.ts` 的內容確認已進 `research.md`，**刪除該檔**
      —— ⚠️ 與 `126` 同一條：暫時檔不得留在測試目錄裡沒有歸屬

---

## Phase 3: User Story 1 - 少了宣告，程式停下來 (P1)

**Independent Test**: 跑一段沒有宣告就指定的程式，看它停不停。

- [ ] T003 [US1] 🔴 在 `tests/integration/` 寫**行為端**的測試：
      跑 `score = 90; cout << score;`，斷言**停下來且訊息含 `score`**
      —— ⚠️ **必須是行為端**（`research` Q2：單元測試看不見「catch 吞掉新行為」）
- [ ] T004 [US1] 🔴 **跑它，確認是紅的**。沒有先看到紅，就不知道它在測什麼
- [ ] T005 [US1] 改 `src/interpreter/scope.ts` 的 `set`：
      引用別名 → 委派；本層有 → 寫入；有父層 → **遞迴**；都沒有 → 拋
      —— 🔴 **拿掉 try/catch**（research 決策 2），⚠️ **不得用 `findOwner`**
- [ ] T006 [US1] 在 `set` 上方寫下**為什麼**，含限定
      「**這是執行期，不是編輯期**」（FR-008 的第 1 處）
- [ ] T007 [US1] T003 轉綠

---

## Phase 4: User Story 2 - 那道擋牆被拆掉，理由被寫下來 (P1)

- [ ] T008 [US2] 改 `tests/unit/scope.test.ts:64` 成斷言**拒絕**
- [ ] T009 [US2] 🔴 在那支測試寫下 **為什麼應該拒絕** ＋ **推翻它需要什麼**
      —— ⚠️ 這一次的根因就是「沒有寫理由」。**只改斷言等於原地換一道同樣的牆**
- [ ] T010 [US2] 🔴 **檢查點（SC-002）**：跑全套。
      失敗數必須 **= 1**（就是 T008 那支，且已改好）。
      ⚠️ **大於 1 → 停下來重新評估，不要硬修**

---

## Phase 5: 不亂報那一側（🔴 比會報更重要）

- [ ] T011 [P] 對照 `plan.md` Phase 0 的基準表，驗**指標寫入**仍輸出 `7`
- [ ] T012 [P] 驗**外層作用域寫入**（迴圈內改 n）仍輸出 `4`
- [ ] T013 [P] 驗**引用別名寫入**（`int& r`）仍輸出 `11`
- [ ] T014 🔴 **FR-006**：把 T011 的結論寫進 `findings.md`
      —— ⚠️ `build-guardrail`：「共用一個症狀不代表共用一個根因」，
      **不論結論是「一起改沒事」還是「要留例外」都要寫**
- [ ] T015 跑三情境語料探針（55 段）＋ APCS，確認通過數不變（SC-003）

---

## Phase 6: User Story 3 - 第二課不必再繞路 (P1)

- [ ] T016 [US3] 🔴 修 `lessons/02-記住一個數字/lesson.md`「換你了」那句
      **今天是假的**提醒——本功能讓它成真
- [ ] T017 [US3] 在第四步後加一小步：讓學生**真的試一次**不加 `int`
      —— ⚠️ 引用的訊息**從系統實際輸出取**，不得是我編的
- [ ] T018 [US3] 在課文寫下限定「**跑到那一行才會停**」（FR-008 的第 3 處）
      —— ⚠️ 不得讓學生以為打字時就會被攔
- [ ] T019 [US3] ⚠️ 確認**三個概念的上限沒被打破**（新步驟是概念一的第二次演練）
- [ ] T020 [US3] 人親自走一遍新的段落

---

## Phase 7: 走查

- [ ] T021 `e2e/lesson-02.spec.ts` 加一支：釘住新段落的訊息**逐字**
- [ ] T022 🔴 注入驗證：改掉期望值 → 必須紅。
      ⚠️ **先 commit**，且 **`lsof -ti:4173 | xargs kill`**
      ——`reuseExistingServer` 會讓注入跑在舊 bundle 上（`126` 撞過）

---

## Phase 8: Polish

- [ ] T023 確認限定寫滿三處（程式碼／spec／課文），SC-006
- [ ] T024 `findings.md`：撞到的坑逐條，含「因為知道答案而跳過的」
- [ ] T025 全套：`npm test`、44 條護欄、e2e 全過
- [ ] T026 🔴 驗 SC-004：`git diff tests/baselines/` 為空
- [ ] T027 知識反流：`experience` / `history` / `vision` 收束第四個缺口

---

## Dependencies

```
Setup(T001) → Foundational(T002)
            → US1(T003-007)   先紅再改
            → US2(T008-010)   🔴 T010 是檢查點，可能中止本輪
            → 不亂報(T011-015)
            → US3(T016-020)
            → 走查(T021-022) → Polish(T023-027)
```

⚠️ **T004 → T005 的順序不可換**（先看到紅）。
⚠️ **T010 有權中止本輪**——那是它存在的理由。

## Parallel Opportunities

- T011 / T012 / T013（三個獨立形狀）

## MVP

**US1 ＋ US2**。⚠️ 而只做 MVP 會留下一句假的課文，所以 US3 同輪做完。
