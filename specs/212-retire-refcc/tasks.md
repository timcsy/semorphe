# Tasks: 參照編譯器族退場（重構 6c-5）

**Input**: `specs/212-retire-refcc/`（spec.md、plan.md、research.md、quickstart.md）
**Tests**: 這一刀本身就是改測試；護欄先紅後綠（constitution II）。

## Phase 1: Setup

- [x] T001 記錄改寫前的基準：每個受影響檔的斷言條數（`grep -c "expect("`）與 `it(` 條數，寫進 `specs/212-retire-refcc/baseline-counts.txt`（SC-004 的對照）

## Phase 2: Foundational（先紅）

- [x] T002 在 `tests/integration/audit-cella-only.test.ts` 加硬性零：`tests/`（扣掉 `tests/probes/`）與 `src/components/**/*.test.ts` 不得 import `tests/helpers/run-cpp`（含注入測試：偵測器認得 `from '../helpers/run-cpp'`、不誤認 `cella-run`）；此時應紅、列出 21 支

## Phase 3: User Story 1 — npm test 不再呼叫參照編譯器（P1）🎯 MVP

**Independent Test**: T002 的硬性零變綠；不設 `SEMORPHE_REFCC_INCLUDE` 跑那 21 支全綠。

- [x] T003 [US1] 一次性擷取工具（不提交，放 `$CLAUDE_JOB_DIR/tmp`）：對 B 族每個 `runCppDetailed(...)` 的呼叫點記下 g++ 的輸出與 Cella 的輸出；輸出一張對照表（檔、測試名、相同／不同）
- [x] T004 [P] [US1] A 族改寫（Cella 跑原始碼與產回的碼、兩份都 accept、輸出相同）：`tests/integration/fuzz-cpp-stacks-queues.test.ts`、`fuzz-cpp-strings.test.ts`、`fuzz-cpp-time.test.ts`、`fuzz-cpp-macros.test.ts`、`roundtrip-cpp-time.test.ts`
- [x] T005 [P] [US1] B 族改寫（期望值改寫死的字串，取自 T003 中「g++ 與 Cella 相同」的那些；不同的逐條判：我們送錯 → 修 formalize，Cella 錯 → `knownCellaGap` 並回報）：`fuzz-cpp-iterators`、`fuzz-cpp-container-kinds`、`roundtrip-cpp-iterators`、`roundtrip-cpp-container-kinds`、`fuzz-cpp-containers-2`、`fuzz-cpp-ranges`、`fuzz-cpp-bits`、`fuzz-cpp-container-ends`、`roundtrip-cpp-container-pop-front`、`roundtrip-cpp-structured-binding`、`cpp-shape-coverage`、`audit-cin-fail-state`（皆在 `tests/integration/`）
- [x] T006 [US1] 拿掉這些檔的 `hasReferenceCompiler()` skipIf 與墊片相關註解；對照 T001 的條數（SC-004）
- [x] T007 [US1] 護欄族退場：刪 `tests/integration/audit-sanitizer-verdict.test.ts`、`audit-refcc-headers.test.ts`、`run-cpp-no-orphans.test.ts` 與它們的基線；`tests/helpers/run-cpp.ts` 的 `sanitizerSaysUB` 隨之刪（只剩它自己用）

## Phase 4: User Story 2 — 課文的答案仍然對得起真正的 C++（P1）

**Independent Test**: 把一課的 `check.stdout` 改錯一個字 → 紅、指名那一課。

- [x] T008 [US2] 新增 `tests/integration/lesson-answers-cella.test.ts`：課文判決綁定語料（同 `tests/probes/binding-verdict.test.ts` 的來源）每一支 Cella accept 且輸出 ＝ 課文預期；不是 accept 的明列；硬性零（或附理由的釘子）
- [x] T009 [US2] 刪 `tests/integration/audit-lesson-answers-vs-compiler.test.ts` 與它的基線；在新檔檔頭寫明接手的是哪一條（老師 2026-09-21 的回饋、history 指名）

## Phase 5: User Story 3 — 交叉檢查探針（P2）

**Independent Test**: 不開環境變數 → 跳過；開了 → 列出 g++ 與 Cella 輸出不同的程式。

- [x] T010 [US3] 新增 `tests/probes/refcc-cross-check.test.ts`：課文答案 ＋（有 `STUDYCPP_DIR` 時）學生語料，原始碼給 g++、formalize 給 Cella，比輸出；`SEMORPHE_REFCC_PROBE=1` 才跑；開了而沒有編譯器 → 紅並說明
- [x] T011 [US3] `tests/probes/two-projections-behave.test.ts`：確認仍只在探針範圍、預設跳過（不改行為）

## Phase 6: Polish

- [x] T012 基線：`npm run test:guard` 逐支看，每份動到的基線 note 寫「6c-5：參照編譯器族退場」與數字來由（護欄條數 README、anchor-rot、declaration-assembly、defect-ledger、語料族）
- [x] T013 [P] `tools/long-test.sh`：拿掉「全套要帶墊片」那個坑②（改成探針才需要）；`knowledge/skills/long-test-run/SKILL.md` 同步
- [x] T014 [P] CLAUDE.md：🪦 三段改寫（操作刪掉、教訓指名留著）；「什麼時候跑什麼」表裡依賴參照編譯器的列改寫
- [ ] T015 長測試（**不設墊片**）：全套（記時間對照 14.8 分）＋ 整輪 e2e；vsix 不受影響可不建
- [ ] T016 history 寫轉變（6c 完成）；vision〈重構〉第 6 項狀態行；6c 盤點 draft 標 6c-5 完成、整份退場判斷；合併、推送、看 CI

## Dependencies

T001 → T002 → US1（T003 → T005；T004 與 T005 平行；T006、T007 在其後）→ US2 → US3 → Polish。US2、US3 只依賴 T002，可與 US1 平行。

## Parallel Example（US1）

T004（A 族 5 檔）與 T005（B 族 12 檔）檔案不重疊，可分給兩個執行者。

## Implementation Strategy

MVP ＝ Phase 1～3：npm test 不再需要參照編譯器。US2 必須同一個合併一起交（否則課文比對的保證在合併的那一刻消失）。
