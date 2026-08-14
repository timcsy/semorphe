# Tasks: 學生看到的是代號，不是句子

**Input**: Design documents from `specs/126-runtime-message-and-lesson-2/`
**Prerequisites**: [plan.md](plan.md)、[research.md](research.md)、[spec.md](spec.md)

**Tests**: 本功能**要求**測試——US2 整個就是一條護欄，US4 整個就是一支走查。

**Organization**: 依 User Story 分階段。⚠️ 而**階段順序由依賴決定，不是優先序**
（plan 的實作順序：護欄先蓋 → 補文案 → 顯示端 → 產基線 → 課 → 走查）。

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 確認分支 `126-runtime-message-and-lesson-2` 已開、工作區乾淨（`git status`）
- [X] T002 記下四個基準數字：`npm test` 通過數（4161）、護欄條數（43）、
      `new RuntimeError` 拋出點數（72）、e2e 支數（17）
      —— ⚠️ **SC-007 要靠它們才驗得了「一個數字都不動」**

---

## Phase 2: Foundational（阻斷所有 User Story）

- [X] T003 在 `tests/probes/__lesson-mistakes-probe.test.ts` 與
      `tests/probes/__l2probe.test.ts` 上決定歸屬（FR-013）：
      ⚠️ **這兩支的內容已經是 research 的證據來源**，所以不能只是刪
      —— 決定「升格成哪一支正式測試」或「內容已進 research 故刪除」，
      **理由寫進 findings.md**

---

## Phase 3: User Story 2 - 這件事不會再從第三個地方冒出來 (P1) 🔴 先做

**Goal**: 一條錨在**顯示邊界**的護欄，硬性零。

**Independent Test**: 在合成的顯示點塞一個代號形狀的字串 → 變紅且指名。

⚠️ **為什麼 US2 排在 US1 前面**：`build-guardrail` 6.5 逐字
「**護欄先蓋，功能後做**……一個被順便修掉的缺陷不會留下任何紀錄，
而它的同類還會再來」。

- [X] T004 [US2] 寫**自我否證聲明**在 `tests/integration/audit-runtime-message.test.ts` 檔頭
      —— ⚠️ **必須在寫量測之前**（`build-guardrail` 第 2 步，順序不可反）。
      錨在**拋出點數**（合成量），🔴 **不得錨在「顯示代號的數量」**
- [X] T005 [US2] 在同檔實作掃描：從 `src/interpreter/**` 抽出
      `(停止原因身分, 拋出點實際傳的參數)` 組合
- [X] T006 [US2] 在同檔實作判定：把每個組合走一次**顯示路徑**，
      斷言結果不含 `RUNTIME_ERR_`／`%N`／`{name}`／JSON 大括號
- [X] T007 [US2] 加**入口條件**斷言：掃到的拋出點數 ≥ 60（`build-guardrail` 第 9 步）
- [X] T008 [US2] 🔴 **跑它，確認是紅的**（SC-003）。
      ⚠️ **綠即為壞**——既有缺陷已實測存在。**逐項指名**印出報表
- [X] T009 [P] [US2] 注入①：一個**合成**身分（沒有文案）→ 必須**會報**且指名
- [X] T010 [P] [US2] 注入②：一個**合成**身分（文案與參數對得上）→ 必須**不亂報**
      —— ⚠️ 注入**不得使用真實身分**（`build-guardrail` 簽名三）
- [X] T011 [US2] **檢查點**：清點 T008 報出來的每一筆，逐筆說出
      「使用者在什麼情況下會看到那個字串」。🔴 **說不出來的即為誤報**（SC-002b）
      —— 誤報數若 > 0，**回頭改判準**，不要調寬容忍

---

## Phase 4: User Story 1 - 停下來的時候，系統說的是人話 (P1)

**Goal**: 讓 T008 報出來的每一筆變成一句自然語句。

**Independent Test**: 造一個會在執行中停下來的程式，看畫面上的字串。

- [X] T012 [US1] 擴充 `src/i18n/messages.ts` 的查表函式吃**兩套佔位符**（研究決策 1）
      —— ⚠️ 檔頭那段「刻意與 `%1` 不同」的理由**保留並補一句**：
      `%N` 是**為既有執行期文案讓路**，新文案一律具名
- [X] T013 [P] [US1] 補 `src/i18n/zh-TW/blocks.json` 缺的 3 則文案
      （`RUNTIME_ERR_ABORTED`／`UNKNOWN_CONCEPT`／`UNRECOGNIZED_CODE`）
- [X] T014 [P] [US1] 補 `src/i18n/en/blocks.json` 同樣 3 則
- [X] T015 [US1] 🔴 **檢查點**：`RUNTIME_ERR_TYPE_MISMATCH` 的文案要 `%1` 與 `%2`，
      而 32 個拋出點**沒有一個傳 `%2`**。**先決定改哪一邊**：
      改文案（一個參數，便宜、不改行為）vs 改 32 個拋出點（貴）。
      ⚠️ **決定與理由寫進 findings.md**——plan 的預設是改文案
- [X] T016 [US1] 依 T015 的決定實作
- [X] T017 [US1] `src/ui/execution-controller.ts` 三處顯示端改成查表
      （`:355`／`:412`／`:690` 附近），查不到時退回**通用的一句話**（FR-003）
- [X] T018 [US1] 確認「使用者主動中止」不走錯誤顯示路徑（FR-004）
- [X] T019 [US1] 🔴 跑護欄 → **必須轉綠**。逐項確認沒有一筆是靠放寬判準過的
- [X] T020 [US1] 產基線（硬性零），⚠️ **在確認綠之後才產**（`build-guardrail` 6.5）
- [X] T021 [US1] 跑第四十二條護欄（`audit-diagnostic-labels`）
      —— ⚠️ 預期**基線不動**，而**預期要驗**（plan 的風險表）

---

## Phase 5: User Story 3 - 第二課寫得出「你會看到什麼」 (P1)

**Goal**: 第二課，而它的教學主軸是那則錯誤訊息。

**Independent Test**: 一個人照著走完，程式跑得起來，輸出符合期望。

- [X] T022 [US3] 建 `lessons/02-記住一個數字/goal.txt`，內容為期望輸出，
      ⚠️ **用直譯器驗過它真的跑得出來**
- [X] T023 [US3] 寫 `lessons/02-記住一個數字/lesson.md`：三個概念
      （變數／指定／印出會變的東西），⚠️ **避開「未宣告就指定」**
      （research Q3 末：它會跑完，而 C++ 拒絕它）
- [X] T024 [US3] 🔴 課文中間的「打錯變數名」段落：引用的錯誤訊息
      **從系統實際輸出取值**，不得是我編的（FR-009）
- [X] T025 [US3] 🔴 **人親自走一遍**（US3 場景 1）
- [X] T026 [US3] 驗證只新增檔案：`git diff --stat` 對既有共用檔**零改動**（FR-008）

---

## Phase 6: User Story 4 - 這一課明年還走得通 (P2)

- [X] T027 [US4] 寫 `e2e/lesson-02.spec.ts`，斷言錨在**課文寫的內容**上，
      失敗訊息說明是**課文或系統有一邊變了**（FR-010）
- [X] T028 [US4] 🔴 **注入驗證**：改掉一個期望值 → 必須紅。
      ⚠️ **先 commit 再注入**（`history/064`§六：`git checkout` 掃掉未 commit 的東西）
- [X] T029 [US4] 在檔頭寫明**這支不檢測什麼**（`build-guardrail` 第 3 步）
- [X] T030 [US4] 🔴 回答 FR-011：「每加一課要不要手寫一支」
      —— **在寫完的當下就記**，含成本數字（每課幾行）

---

## Phase 7: Polish

- [X] T031 走第二課撞到的坑逐條寫進 `findings.md`，
      含「因為知道答案而跳過的地方」（FR-012、SC-006），並**分類**
- [X] T032 全套：`npm test` 全綠、43+1 條護欄、e2e 全過
- [X] T033 🔴 驗 SC-007：既有 43 條護欄基線**一個數字都沒動**（`git diff tests/baselines/`）
- [X] T034 知識反流：`experience` / `history` / `vision` 收束階段 6.9

---

## Dependencies

```
Setup(T001-002) → Foundational(T003)
                → US2(T004-011)  🔴 護欄先蓋
                → US1(T012-021)  補文案／顯示端 → 護欄轉綠 → 產基線
                → US3(T022-026)  課文引用【修好後】的訊息
                → US4(T027-030)  走查釘住課文
                → Polish(T031-034)
```

⚠️ **US2 → US1 的順序不可換**（護欄先蓋）。
⚠️ **US1 → US3 的順序不可換**（課文要引用真實訊息）。

## Parallel Opportunities

- T009 / T010（兩個注入，互不相干）
- T013 / T014（兩份語言檔）

## MVP

**US2 ＋ US1**——護欄 ＋ 訊息。US3／US4 是它的消費者與保險。
⚠️ 而**只做 MVP 會落回「機制有了沒人接上」**，所以本輪四個都做。
