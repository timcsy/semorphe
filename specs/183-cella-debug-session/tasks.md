# Tasks: Cella 的除錯工作階段（spec 183，重構階段 5b）

**Tests**: 憲章 II（TDD）——介面契約先寫，兩個提供者跑同一組。

## Phase 1: 介面（Foundational）

- [x] T001 `src/core/capabilities.ts`：`ExecutionSession` 換成 DAP 的形狀——`setBreakpoints`、`launch(program, { stopOnEntry })`、`continue`／`stepIn`／`stepOut`／`pause`／`terminate`，
      每個指令回 `Outcome`（`stopped { reason, nodeId, detail }`／`ended`／`failed SessionStop`）；`variables()`、`setVariable`、`supplyInput`／`closeInput`、`coverage()`（R2）、`recordedInputs()`；
      `Provider.createSession` 可以回「不接」＋原因（R3）；`provide('session', program)` 往下找
- [x] T002 [P] `tests/contract/session-contract.test.ts`：同一組情境（跑到底、中斷點、單步、等輸入、改變數、未定義行為、停止）對每個提供者跑——先紅
- [x] T003 `src/providers/js-interpreter/index.ts`：把直譯器的回呼模型包成新形狀（今天在控制器裡的 `animateResolve` 那一套搬進來）；契約對 JS 綠

## Phase 2: 控制器（US1 的一半，先用 JS 提供者驗）

- [x] T004 `src/ui/execution-controller.ts`：執行＝`continue`＋中斷點、單步＝`stepIn`、動畫＝`stepIn`＋延遲、加速＝連續 `stepIn` 直到離開那一層；拿掉 `runWithSteps` 的先錄再播
- [x] T005 跑既有的執行與除錯 e2e（`debug.spec`、執行、輸入、改變數那幾支）——全綠才往下（此時仍全由 JS 跑）

## Phase 3: Cella 提供者（US1、US2）

- [ ] T006 `src/providers/cella/worker.ts`：DAP 模組（R4：第一次需要時才編、IndexedDB 第二個鍵）；工作階段的訊息協定
- [ ] T007 `src/providers/cella/provider.ts`：宣告 `session`；`createSession` 對翻不出來／未就緒／無法使用回「不接」＋原因
- [ ] T008 契約對 Cella 綠（Node 端，走 `cella-lang/dap`，不經 worker）
- [ ] T009 停下原因的中文：未定義行為（附條文）、例外、等輸入——與 5a 的 i18n 同一族

## Phase 4: 退回與出處（US3）

- [ ] T010 狀態列顯示這次由誰跑、退回原因；`missing: steps` 時說「這次沒有覆蓋資料」
- [ ] T011 e2e `e2e/cella-session.spec.ts`：Cella 跑（輸出、中斷點、變數、等輸入、越界停下）＋退回（`map`）標出處

## Phase 5: Polish

- [ ] T012 護欄與基線；`verify-in-browser`（執行路徑的四件：停在哪、狀態在不在、繼續之後對不對、有沒有留痕）
- [ ] T013 全套＋e2e；合進 main；看 CI；vision 5b 打勾；history 一筆
