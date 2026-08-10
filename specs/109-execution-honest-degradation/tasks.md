# Tasks：執行那一路的誠實降級

## Phase 1：US1 — 四個顯示與計算的根因

- [ ] T001 [US1] 建立 `tests/integration/interpreter-value-fidelity.test.ts`，**先寫四支會紅的回歸測試**：`char c=66`→`B`、`1.0/3`→`0.333333`、`throw 10`→`10`、`accumulate`→`15`
- [ ] T002 [US1] 修 `src/interpreter/interpreter.ts:389` 的 `char` 轉型 → commit
- [ ] T003 [US1] 修 `src/interpreter/types.ts` 的浮點顯示（六位有效數字、去尾零）→ commit
- [ ] T004 [US1] 修 `src/languages/cpp/core/executors/control-flow.ts:143` 的 catch 傳值 → commit
- [ ] T005 [US1] 修 `src/languages/cpp/std/numeric/executors.ts:54` 的 `cpp:range_sum` 空實作（解析不了要擲錯）→ commit

## Phase 2：US2 — 建構子（零覆蓋路徑，最後做）

- [ ] T006 [US2] 加回歸測試：預設建構子被呼叫、帶參數建構子、成員預設值、**以及「沒有建構子的型別行為不變」**（FR-008）
- [ ] T007 [US2] 讓變數宣告為類別型別時查 `constructorOf` 並執行
- [ ] T008 [US2] 讓 `A a(5)` 這個宣告形式走同一條路
- [ ] T009 [US2] 跑全套確認沒有回歸 → commit

## Phase 3：US3 — 歸因與基線

- [ ] T010 [US3] 重跑第三十二條護欄，看誤差從 31 降到多少
- [ ] T011 [US3] `tests/assets/behavior-error-decisions.json` 每筆補**根因**欄，移除已修好的（會被孤兒檢查抓到）
- [ ] T012 [US3] 下調誤差基線，`_meta` 註明「因為實作了」→ commit

## Phase 4：Polish

- [ ] T013 `npm test` 全綠、`npx tsc --noEmit` 綠
- [ ] T014 **更正 `knowledge/concepts/執行機構.md:168`** 那句過期論斷（「直譯器不支援物件導向」已被 071/072/073 推翻）
- [ ] T015 寫 `knowledge/history/038`

## Dependencies

```
T001 → T002/T003/T004/T005（可任意順序）
T006 → T007 → T008 → T009
全部 → T010 → T011 → T012 → T013 → T014/T015
```

## MVP

**Phase 1**（T001–T005）。四個單行修法，使用者可見，且不碰零覆蓋路徑。
