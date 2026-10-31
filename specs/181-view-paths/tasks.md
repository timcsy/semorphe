# Tasks: 元件動詞改名——每個視圖一對 render／lift

**Input**: `specs/181-view-paths/`（plan.md、spec.md、research.md、data-model.md、contracts/、quickstart.md）

**Tests**: 憲章 II（TDD）要求——契約檢查先寫測試、先紅。

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [x] T001 記下改寫前的計數（research R1 那張表）到 scratchpad 的 `before.json`：各鍵顆數、各鍵的 `null` 數、各 `_why` 數、`liftStrategy` 數

---

## Phase 2: Foundational（核心的型別與契約）

**⚠️ 這一段完成前，任何讀取者都不能改**

- [x] T002 先寫契約測試（紅）於 `tests/unit/core/component-paths-contract.test.ts`：新形狀接受；平鋪舊鍵擋下；雙向視圖少 `lift` 鍵擋下；單向視圖有 `lift` 擋下；`null` 無同層 `_why` 擋下；未知視圖名擋下；訊息說出元件與視圖
- [x] T003 在 `src/core/component/types.ts` 新增視圖表（`blocks`、`code` 皆雙向）、`ViewPaths`／`ComponentPaths` 型別、格子名（`blocks.render`、`blocks.lift`、`code.render`、`code.lift`、`code.liftStrategy`、`formalize`、`execute`）與 `cellPath(manifest, cell)` 查詢；移除 `FivePath`／`FIVE_PATHS`
- [x] T004 在 `src/core/component/registry.ts` 把 C3 換成 data-model 的五條驗證規則（讓 T002 轉綠）

---

## Phase 3: User Story 1 - 學生什麼都沒感覺到（P1）🎯 MVP

**Goal**: 349 個宣告改成新形狀，所有讀取者跟上，行為零改變

**Independent Test**: 全套與 e2e 改動前後都全綠；課文解答往返逐一相同

- [x] T005 [US1] 一次性改寫腳本（scratchpad，不進 repo）：依 research R3 改寫 `src/components/*/*/component.json` 的 `paths`，保留其他欄位、縮排與換行；改完重算計數並與 T001 的 `before.json` 逐格比對，不一致就停（SC-003）
- [x] T006 [US1] `src/core/component/paths.ts`：實作檔掃描改用 `cellPath`（generate → `code.render`、lift → `code.lift`、liftStrategy → `code.liftStrategy`、execute → `execute`）
- [x] T007 [US1] `src/core/component/judges.ts`：`PATH_JUDGE` 的鍵改成格子名（`liftStrategy` 不單獨判定）、`SIX_PATHS` 換成格子清單、`judgeOf` 照新鍵；說明文字裡的舊鍵名同步
- [x] T008 [P] [US1] `tests/helpers/component-paths.ts` 與 `tests/unit/core/component-paths.test.ts`：覆蓋表改用格子
- [x] T009 [P] [US1] `tests/integration/audit-judge-coverage.test.ts` 與 `tests/baselines/judge-coverage.json`：`byPath` 鍵改名，數字逐一不變（SC-005）
- [x] T010 [P] [US1] `tests/integration/audit-completeness.test.ts`、`audit-projection-home.test.ts`、`audit-projection-loss.test.ts`、`audit-lift-grammar.test.ts`、`python-first-block.test.ts`：改用 `cellPath`
- [x] T011 [P] [US1] `tests/probes/studycpp-has-blocks.test.ts`、`tests/probes/judge-coverage-execute.test.ts`、`src/components/cpp/{string_empty,queue_back}/spec.test.ts`、`src/components/cpp/literal_char/lift.ts`：逐一看，判準用到舊鍵的改、純敘述的照 R2 判斷
- [x] T012 [US1] `tests/assets/declared-slots-decisions.json`、基線 `declared-slots.json`、`shared-file-husks.json`：判準用到舊鍵的改，純敘述的不動
- [x] T013 [US1] 全 repo 搜尋舊鍵的讀取（⚠️ 實作時多量到一組同詞彙：`skipPaths`／`skipReasons` 與 `PathName`，一併改成格子名；`audit-completeness` 基線同步）（`paths.render|extract|generate|lift|liftStrategy` 與以字串取鍵）＝ 0；`npx tsc --noEmit` 綠
- [x] T014 [US1] 跑相關護欄與單元（`test:unit`、`test:capsule`、`test:guard` 帶 `SEMORPHE_REFCC_INCLUDE`），依理由手動調基線；commit

---

## Phase 4: User Story 2 - 加一個視圖不必發明新動詞（P1）

**Goal**: 視圖是宣告裡的鍵，方向由視圖表決定

**Independent Test**: T002 裡的單向假視圖、只寫 lift、未知視圖名三支

- [x] T015 [US2] 在 T002 的檔裡補「加一個單向視圖只動視圖表與宣告」的測試：以測試用的視圖表加一筆 `render-only`，確認核心的格子查詢不必改（SC-004）
- [x] T016 [US2] `src/core/component/types.ts` 的視圖表加註解：加一個視圖＝加一筆；方向由視圖決定（research R4）；commit

---

## Phase 5: User Story 3 - 原則與概念文件說的是現在的事（P2）

**Goal**: P2、五槽、完備性 ⑤ 改成定案文字，留 history

**Independent Test**: `audit-knowledge-links` 綠；P2 檢驗表的每句對得到一條在跑的護欄

- [x] T017 [P] [US3] `knowledge/principles.md`：P2 原文與最終檢驗表那一列改成五之四定案的文字
- [x] T018 [P] [US3] `knowledge/concepts/元件.md`：五槽表與名詞表改成「身分・接點・參數・形態・形式」，「行為」留在投影族的說明
- [x] T019 [P] [US3] `knowledge/concepts/元件代數.md`：完備性 ⑤ 改成「formalize 存在」
- [x] T020 [US3] 新增 `knowledge/history/<下一號>-元件的動詞改成每個視圖一對.md`：轉變、理由、連回 306 與設計 draft 五之四／五之五；設計 draft 五之四、五之五標「已落地」；vision 階段 2 打勾；commit

---

## Phase 6: Polish & Cross-Cutting

- [ ] T021 `SEMORPHE_REFCC_INCLUDE=$PWD/tests/fixtures/refcc-shim npm test` 全綠（背景跑，先確認 cella 不在測）
- [ ] T022 `npm run test:e2e` 全綠（背景跑）
- [ ] T023 合進 main（`merge --no-ff`）、push、看 CI

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → Phase 3（US1）→ Phase 4（US2，依賴 T003）／Phase 5（US3，可與 US1 並行，只動 knowledge）→ Phase 6
- US1 內：T005（改寫宣告）與 T006–T007（核心讀取者）必須同一個 commit 前完成，否則登錄表載不起來
- T008–T011 標 [P]：不同檔、互不依賴

## Parallel Example: User Story 1

```text
T008 tests/helpers/component-paths.ts
T009 tests/integration/audit-judge-coverage.test.ts
T010 tests/integration/audit-completeness.test.ts …
T011 tests/probes/studycpp-has-blocks.test.ts …
```

## Implementation Strategy

- **MVP = US1**：宣告與讀取者一起換，行為不變——這一段做完就可以合併。
- US2 是 US1 的形狀自然帶來的，補測試與註解即可。
- US3 只動知識庫，可與 US1 並行，但同一刀合併（使用者定：P2 與五槽隨階段 2 一起改）。
