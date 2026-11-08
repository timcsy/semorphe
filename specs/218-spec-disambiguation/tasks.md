# Tasks: 規格消歧試驗（第一版 C 與 Arduino）

**Input**: Design documents from `specs/218-spec-disambiguation/`
**Prerequisites**: plan.md、spec.md、research.md、data-model.md、contracts/
**Tests**: 要（constitution II：測試驅動，非妥協）——每個 US 先寫紅的測試

## Phase 1: Setup

- [X] T001 建資料夾 `src/core/disambiguation/` 與 `src/languages/cpp/scenarios/`（各放一行說明它住誰的檔頭註解於第一個檔案裡，不另建 README）

## Phase 2: Foundational（阻擋所有 US）

- [X] T002 [P] 寫型別 `Scenario`、`Interpretation`、`RunOutcome`、`ComparisonResult`、`Judge` 於 `src/core/disambiguation/types.ts`（照 data-model.md）
- [X] T003 [P] 先寫紅的測試：登記處兩次登記同一個 kind 會 throw、產生器決定性、每種上限 20，於 `tests/unit/core/disambiguation/scenario-registry.test.ts`
- [X] T004 實作 `registerScenarioKind`／`scenariosFor` 於 `src/core/disambiguation/scenario-registry.ts`（核心不寫出任何 kind 名字）
- [X] T005 [P] 先寫紅的測試：`solutionFor('ex1')` 不得撈到 `ex1~a.c`；`interpretationSolutionFor(lesson, task, id)` 讀得到 `<task>~<id>.<ext>`，於 `tests/unit/core/lesson/interpretation-solutions.test.ts`
- [X] T006 `load-lessons.ts`：任務型別多 `interpretations?: {id,label}[]`；`solutionFor` 只比對 `<task>.<ext>`；新增 `interpretationSolutionFor`，於 `src/core/lesson/load-lessons.ts`

## Phase 3: User Story 1 — 學生的程式和哪幾種讀法一致（P1）🎯 MVP

**Goal**: C 題目兩個解讀，三支示範程式的比對結果 {A}／{B}／{}，不一致附情境與兩邊輸出。
**Independent Test**: `tests/integration/disambiguation-c.test.ts` 全綠。

- [ ] T007 [P] [US1] 先寫紅的單元測試：比對器的四種狀態（一致、不一致附第一個、不可比、分不出的解讀群）用假的 Judge，於 `tests/unit/core/disambiguation/compare.test.ts`
- [ ] T008 [US1] 實作 `compareInterpretations` 於 `src/core/disambiguation/compare.ts`（不 import DOM／fs／提供者；判決不是 accept 的情境標不可比；單一解讀退化成對錯）
- [ ] T009 [P] [US1] 把 `tests/helpers/stdin-from-tree.ts` 的邏輯搬到 `src/languages/cpp/scenarios/stdin.ts`，測試輔助改成 re-export（既有測試不動）
- [ ] T010 [US1] C 的 `stdin` 情境產生器：依讀取的型別與順序產生多組（一般、空輸入、提前結尾、0、負數、大數），登記 kind，於 `src/languages/cpp/scenarios/stdin.ts`；在語言套件的組裝點登記（`src/languages/cpp/pack.ts` 或同層的註冊點）
- [ ] T011 [P] [US1] 示範題：在 `lessons/c-bridge/` 挑一課加一題（讀一串數字印最大值：讀到 0 停 vs. 讀到檔尾停），`lesson.json` 宣告兩個解讀、`solutions/<task>~zero.c`、`solutions/<task>~eof.c`，同時保留 `solutions/<task>.c`（= 其中一個，給今天的對錯與 Parsons）
- [ ] T012 [US1] 先寫紅的整合測試：三支示範程式（符合 zero、符合 eof、都不符）的比對結果與第一個不一致情境，Judge 包 `runCella`，於 `tests/integration/disambiguation-c.test.ts`；再讓它轉綠
- [ ] T013 [US1] 退化測試：既有課文（沒宣告解讀）的對錯不變，於 `tests/integration/disambiguation-c.test.ts`

## Phase 4: User Story 2 — Arduino 題目也能比（P2）

**Goal**: Arduino 按鈕題兩種讀法用時間序列情境分得出。
**Independent Test**: `tests/integration/disambiguation-arduino.test.ts` 全綠。

- [ ] T014 [P] [US2] 判決請求多一格選用的 `boardInputs` 於 `src/core/capabilities.ts`（`CheckRequest`），Cella 提供者把它放進程式 JSON 的 `inputs`，於 `src/providers/cella/provider.ts`
- [ ] T015 [US2] Arduino 的 `board-inputs` 情境產生器：找讀取的輸入腳（digitalRead／analogRead），產生一直低／一直高／某刻按下／按下又放開／類比階梯，於 `src/languages/cpp/scenarios/board-inputs.ts`（登記 kind）
- [ ] T016 [P] [US2] 示範題：`lessons/arduino/04-按鈕` 加一題（按一下切換 vs. 按住才亮），兩個解讀與解答
- [ ] T017 [US2] 先寫紅的整合測試：Arduino 示範題比對結果、第一個不一致附時間點與兩邊腳位，於 `tests/integration/disambiguation-arduino.test.ts`；再讓它轉綠

## Phase 5: User Story 3 — 老師看並排畫面並點選（P3）

**Goal**: 課文頁並排每個解讀、能點選、選擇被記住、之後只照被選的判。
**Independent Test**: `e2e/disambiguation.spec.ts` 全綠。

- [ ] T018 [P] [US3] 產品的 Judge：把一個情境變成判決請求（stdin／boardInputs），於 `src/providers/cella/judge.ts`
- [ ] T019 [US3] 老師的選擇：讀寫 localStorage（`semorphe-disambiguation`），於 `src/ui/lesson-disambiguation.ts`
- [ ] T020 [US3] 並排畫面：題目有兩個以上解讀時，判題後顯示每個解讀一欄（名稱、一致／不一致／不可比、第一個不一致的情境與兩邊輸出）與「題目指的是這一種」按鈕，於 `src/ui/lesson-disambiguation.ts`，掛進判題結果的呈現處
- [ ] T021 [US3] 判題只照被選的解讀（沒選時照今天：預設解答），於判題流程（課文 check 的位置）
- [ ] T022 [US3] 先寫紅的 e2e：打開示範課文、交一支程式、看到兩欄並排、點選、重新整理後選擇還在、再判只照被選的，於 `e2e/disambiguation.spec.ts`；再讓它轉綠
- [ ] T023 [P] [US3] 介面文字中英兩份（i18n）

## Phase 6: Polish & 護欄

- [ ] T024 [P] 護欄 `tests/integration/audit-disambiguation.test.ts`：宣告了的解讀都有解答檔；核心（`src/core/disambiguation/`）不出現任何登記過的 kind 名字；比對器不 import DOM／`node:fs`／提供者（量 import）
- [ ] T025 [P] 兩個宿主同結果：同一份比對分別經 Node 的判決與瀏覽器 worker 協定（`tests/helpers/cella-run` 的 worker 路徑），結果相同，於 `tests/integration/disambiguation-hosts.test.ts`
- [ ] T026 量 SC-005：示範題完整比對的時間，記在 quickstart.md
- [ ] T027 基線與護欄調整（新檔、新匯出、課程快照若變）；`npx tsc --noEmit`、`npm run test:guard`、`npm run test:unit`
- [ ] T028 知識庫：vision〈規格消歧試驗〉狀態、draft 標記；完成時 reflow（history）

## Dependencies & Execution Order

- Phase 2 阻擋全部 US。US1（MVP）→ US2（重用比對器，只加情境種類與請求欄位）→ US3（畫面，需要 US1 的比對器與 T018 的產品 Judge）。
- [P] 標的是不同檔、互不依賴：T002／T003／T005 可並行；T007／T009／T011 可並行；T014／T016 可並行。

## Implementation Strategy

- MVP = Phase 1＋2＋US1：比對器與 C 情境在 Node 測試裡就能用（cos-mos 的批次也能直接接）。
- 之後 US2 驗證抽象（第二種情境）、US3 給老師看；每一階段都可單獨合併（長測試綠）。
