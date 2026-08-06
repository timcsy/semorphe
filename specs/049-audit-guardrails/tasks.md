---

description: "Task list for 049-audit-guardrails"
---

# Tasks: 四條護欄——碎裂、殼與缺陷帳的基線與棘輪

**Input**: Design documents from `/specs/049-audit-guardrails/`

**Prerequisites**: plan.md、spec.md、research.md、data-model.md、contracts/、quickstart.md

**Tests**: 本功能的**產出本身就是測試**。憲章 II（TDD 非妥協）在此的形式是：**先寫斷言（紅：基線缺失）→ 產生基線 → 綠**，而不是「違規數歸零才綠」（見 plan.md 憲章檢查的註記）。掃描規則等純邏輯另有單元測試。

**Organization**: 依 User Story 分組，每組獨立可實作、可測試、可交付。

## Format: `[ID] [P?] [Story] Description`

- **[P]**：可平行（不同檔、無未完成相依）
- **[Story]**：US1–US4，對應 spec.md 的 User Story
- 每個任務都含確切檔案路徑

## Path Conventions

單一專案：`src/`、`tests/` 位於 repo 根目錄。

---

## Phase 1: Setup（共用基礎）

**Purpose**: 建立基線目錄與棘輪語義的說明

- [X] T001 建立 `tests/baselines/` 目錄，並寫 `tests/baselines/README.md` 說明棘輪語義（數字只准下降；放寬基線＝一次 commit，須在訊息說明原因）

---

## Phase 2: Foundational（阻斷性前置）

**Purpose**: 四條護欄共用的骨架與掃描規則。**必須全部完成才能進入任何 User Story。**

- [X] T002 在 `tests/helpers/guardrail.ts` 定義護欄共用形狀：`measure()` / `report()` / `compare(result, baseline)`，以及從 `tests/baselines/<name>.json` 載入基線
- [X] T003 在 `tests/helpers/guardrail.ts` 實作 `compare` **回傳新增項清單而非布林**（FR-005 要求失敗時指名是哪一項），並在基線檔缺失時擲出可讀錯誤（指示先產生基線）
- [X] T004 [P] 在 `tests/helpers/component-scan.ts` 實作 `allComponentIds()`：彙整 universal + core + 全部 std 模組的 conceptId（重用 `setup-lifter.ts` 既有的載入方式）
- [X] T005 在 `tests/helpers/component-scan.ts` 實作 D1 掃描規則：字邊界比對、先剝行註解與區塊註解，回傳**程式碼引用**與**註解引用**兩份結果
- [X] T006 [P] 在 `src/core/types.ts` 的 `ConceptDefJSON` 新增可選欄位 `skipPaths?: PathName[]`（純資料、可選、既有元件零改動）
- [X] T007 在 `tests/unit/helpers/component-scan.test.ts` 為掃描規則寫單元測試：`cpp_string_at` 不得命中 `cpp_string_at_expr`（前綴誤報）、註解中的引用歸入註解結果、字串字面中的引用歸入程式碼結果

**Checkpoint**: T007 綠 → 掃描規則可信，四條護欄可平行開工

---

## Phase 3: User Story 1 — 中立性護欄（Priority: P1）🎯 MVP

**Goal**: 用一條測試回答「拔掉 C++ 之後系統還能不能跑」——量出核心與呈現層有幾個檔案認得語言專屬的元件身分。

**Independent Test**: 單獨跑 `audit-neutrality.test.ts` 即得違規清單，可據以排後續清償順序；其餘三條護欄不存在也不影響。

- [X] T008 [US1] 在 `tests/integration/audit-neutrality.test.ts` 寫斷言骨架（此時應**紅**：`tests/baselines/neutrality.json` 尚未存在）
- [X] T009 [US1] 在 `tests/integration/audit-neutrality.test.ts` 實作 `measure`：掃 `src/core/`、`src/ui/`、`src/interpreter/`、`src/views/`，用 T005 的規則產生 `NeutralityResult`
- [X] T010 [US1] 在 `tests/integration/audit-neutrality.test.ts` 實作 `report`：列出違規檔案 × componentId × 行號；**註解引用另列一區塊且不計入總數**
- [X] T011 [US1] 跑一次護欄產生 `tests/baselines/neutrality.json`（含 `_meta.rule` 記載判定方式），確認 `total` 為正數後 commit
- [X] T012 [US1] 依 quickstart 情境 2 驗證棘輪：在 `src/core/` 任一檔加一行含 componentId 的程式碼 → 護欄失敗且**指名該檔與該 id** → 還原後通過

**Checkpoint**: US1 完成即可獨立交付——中立性基線可見、惡化擋得住

---

## Phase 4: User Story 2 — 完備性護欄（Priority: P1）

**Goal**: 分辨「做完了」與「看起來做完了」。實際執行每個元件的五條路徑，分類為實作／殼／缺，輸出補完地圖。

**Independent Test**: 單獨跑 `audit-completeness.test.ts` 即得涵蓋全部元件的補完地圖，可直接當補完工作清單。

- [ ] T013 [US2] 在 `tests/helpers/synth-node.ts` 實作 `synthMinimalNode(def: ConceptDefJSON)`：由 `properties` 填預設值、`children` 填最小子節點，合成最小 `SemanticNode`
- [ ] T014 [US2] 在 `tests/helpers/synth-node.ts` 實作兩種組態的建構（research.md D3）：**現行組態**（不接 TemplateGenerator、不套 Topic）與**宣告組態**（接上載入 universal templates 與各 blockSpec `codeTemplate` 的 TemplateGenerator）
- [ ] T015 [US2] 在 `tests/integration/audit-completeness.test.ts` 寫斷言骨架（此時應**紅**：基線尚未存在）
- [ ] T016 [US2] 在 `tests/integration/audit-completeness.test.ts` 實作 **generate** 路徑的 Verdict：無 generator 且無 codeTemplate → 缺；輸出空／佔位／擲例外 → 殼；否則實作
- [ ] T017 [US2] 在 `tests/integration/audit-completeness.test.ts` 實作 **lift** 路徑的 Verdict：以 T016 的 generate 輸出當輸入，比對回來的 componentId 與 confidence（`raw_code` → 殼）
- [ ] T018 [US2] 在 `tests/integration/audit-completeness.test.ts` 實作 **render** 與 **extract** 路徑的 Verdict（產不出積木或退回泛用積木 → 殼；extract 回來的 componentId 不符 → 殼）
- [ ] T019 [US2] 在 `tests/integration/audit-completeness.test.ts` 實作 **execute** 路徑的 Verdict：讀 `skipPaths` 區分「刻意的空」（實作）與「未宣告的空操作」（殼）
- [ ] T020 [US2] 在 `tests/integration/audit-completeness.test.ts` 實作兩組態比對，產生 `configDelta`（FR-023）
- [ ] T021 [US2] 在 `tests/integration/audit-completeness.test.ts` 實作 `report`，並寫出補完地圖 `tests/reports/completeness-map.md`（元件 × 五路徑矩陣，**涵蓋全部元件、無靜默略過**）
- [ ] T022 [US2] 在報表開頭固定印出聲明：**本護欄不檢測「條件性正確」**（單獨測通過、組合時失敗）（FR-025）
- [ ] T023 [US2] 跑一次護欄產生 `tests/baselines/completeness.json`，確認 `shell` 與 `missing` 為正數、`configDelta` **非空**（依 research.md F3，93 個 codeTemplate 應照出來）後 commit
- [ ] T024 [US2] 依 quickstart 情境 4 驗證：找一個未宣告的空 executor → 判為殼 → 加 `skipPaths: ["execute"]` → 改判實作 → **還原**（本功能只量不修）

**Checkpoint**: US2 完成即可獨立交付——補完地圖可用、殼與缺有數字

---

## Phase 5: User Story 3 — 缺陷帳護欄（Priority: P2）

**Goal**: 讓被歸檔的缺陷重新可見，並讓「修一個解鎖多個」的優先序第一次能被回答。

**Independent Test**: 單獨跑 `audit-defect-ledger.test.ts` 即得分類統計與阻斷者彙總。

### 護欄本體

- [ ] T025 [US3] 在 `tests/helpers/disabled-scan.ts` 實作停用測試掃描：找出 `it.todo`／`it.skip`／`describe.skip`，記錄檔案、行號、`scope`（test／describe）與標題
- [ ] T026 [US3] 在 `tests/integration/audit-defect-ledger.test.ts` 寫斷言骨架（此時應**紅**：全部項目皆未分類）
- [ ] T027 [US3] 在 `tests/integration/audit-defect-ledger.test.ts` 實作標記解析：`[BLOCKED:<id>]`／`[TOMBSTONE:<檔名#錨點>]`／`[DEADSKIP]`
- [ ] T028 [US3] 在 `tests/integration/audit-defect-ledger.test.ts` 驗證 `[BLOCKED:x]` 的 `x` 存在於註冊表（重用 T004）
- [ ] T029 [US3] 在 `tests/integration/audit-defect-ledger.test.ts` 驗證 `[TOMBSTONE:F#A]` 的 `knowledge/history/F.md` 存在且含錨點 `A`
- [ ] T030 [US3] 在 `tests/integration/audit-defect-ledger.test.ts` 實作 `byBlocker` 彙總與報表（FR-034：使「修一個解鎖多個」可見）

### 為既有存量補標記

- [ ] T031 [US3] 為 `tests/integration/fuzz-cpp-string.test.ts` 的 10 個 `it.todo` 補 `[BLOCKED:print]`（根因是 cout lifter 認不出 complex chain，非 string 概念的缺陷）
- [ ] T032 [P] [US3] 為 `tests/integration/fuzz-cpp-arrays-pointers.test.ts`、`fuzz-cpp-types-advanced-ops.test.ts`、`fuzz-cpp-cstring.test.ts` 的 `it.todo` 補標記（逐一判定阻斷者）
- [ ] T033 [P] [US3] 為 `tests/integration/fuzz-cpp-control-flow.test.ts`、`fuzz-cpp-variables-ops.test.ts`、`fuzz-cpp-strings.test.ts`、`fuzz-cpp-oop.test.ts`、`fuzz-cpp-cstdlib.test.ts`、`fuzz-cpp-advanced.test.ts` 的 `it.todo` 補標記
- [ ] T034 [US3] 為 `tests/integration/fuzz-cpp-functions-io.test.ts:277` 的 `#define` skip 補 `[TOMBSTONE:014-墓碑目錄#模擬-c-preprocessor-來解決巨集]`（**它是已否決決定的正確後果，不是缺陷**）
- [ ] T035 [US3] 為 `tests/integration/fuzz-cpp-functions-io.test.ts:404` 標題含 `(fixed)` 的 `describe.skip` 補 `[DEADSKIP]`（已修好卻沒開回來）
- [ ] T036 [US3] 為 `tests/integration/roundtrip-functions-io.test.ts:253,308` 兩個**完全沒寫理由**的 `it.skip` 判定分類並補標記
- [ ] T037 [P] [US3] 為 `tests/integration/fuzz-cpp-stacks-queues.test.ts`（2 個 DEGRADED）、`fuzz-cpp-oop.test.ts`（SEMANTIC_DIFF）、`fuzz-cpp-variables-ops.test.ts`（2 個 describe.skip）、`fuzz-cpp-types-advanced-ops.test.ts`（3 個 describe.skip）補標記
- [ ] T038 [US3] 跑一次護欄確認 `unclassified` 為空，產生 `tests/baselines/defect-ledger.json` 後 commit

**Checkpoint**: US3 完成即可獨立交付——清償優先序可見

---

## Phase 6: User Story 4 — 就近性護欄（Priority: P3）

**Goal**: 量出「加一個元件要動幾個檔」，作為碎裂清償的進度計。

**Independent Test**: 單獨跑 `audit-locality.test.ts` 即得每元件擴散度排名，可用來排搬移順序。

- [X] T039 [US4] 在 `tests/integration/audit-locality.test.ts` 寫斷言骨架（此時應**紅**：基線尚未存在）
- [X] T040 [US4] 在 `tests/integration/audit-locality.test.ts` 實作 `measure`：掃 `src/` 全部，對每個 componentId 算檔案數與目錄數（重用 T005）
- [X] T041 [US4] 在 `tests/integration/audit-locality.test.ts` 實作 `report`：擴散度排名（最擴散的前幾名）
- [X] T042 [US4] 跑一次護欄產生 `tests/baselines/locality.json`（只記每元件上限、不記路徑清單），確認 `cpp_string_at` 的數字為正後 commit

**Checkpoint**: 四條護欄全數就位

---

## Phase 7: Polish & Cross-Cutting

- [ ] T043 執行 `time npm test`，確認四條護欄合計新增 **≤ 10 秒**（SC-007）；若超出，依 research.md D5 用 vitest 專案切分並記錄理由
- [ ] T044 確認既有 3006 測全綠、**零行為改動**（SC-006）——除新增護欄輸出外無任何既有輸出改變
- [ ] T045 依 `quickstart.md` 八個情境逐一驗收，特別確認情境 5（組態差異區塊**非空**）與情境 6（補完地圖涵蓋全部元件）
- [ ] T046 更新 `knowledge/vision.md` 階段 6.5：勾選「P0 四條護欄進 CI，各自輸出非零基線數字」，並把四個實測基線數字填入
- [ ] T047 更新 `knowledge/draft/2026-08-05-元件膠囊重構.md`：把 P0 一節的預估基線換成實測值，並記錄 research.md F1–F3 三個既有事實（`module.ts` 死碼、app 從未接 TemplateGenerator、93 個 codeTemplate 未被使用）

---

## Dependencies

```
Phase 1 (T001)
    ↓
Phase 2 Foundational (T002–T007)   ← 阻斷全部 User Story
    ↓
    ├─→ Phase 3 US1 中立性  (T008–T012)   ← MVP，可獨立交付
    ├─→ Phase 4 US2 完備性  (T013–T024)   ← 需 T006 skipPaths
    ├─→ Phase 5 US3 缺陷帳  (T025–T038)   ← 需 T004 註冊表列舉
    └─→ Phase 6 US4 就近性  (T039–T042)   ← 需 T005 掃描規則
              ↓
        Phase 7 Polish (T043–T047)
```

**Story 間無相依**——四條護欄各自獨立，Foundational 完成後可任意順序或平行進行。

**Foundational 內部**：T002 → T003（同檔）；T004、T006 可平行；T005 需 T004（要知道有哪些 id 才能掃）；T007 需 T005。

## Parallel Opportunities

**Phase 2 內**：
```
T004 [P] component-scan 的列舉
T006 [P] types.ts 的 skipPaths
```

**Foundational 完成後，四個 Story 可同時開工**（不同檔案、無交叉相依）：
```
US1: tests/integration/audit-neutrality.test.ts
US2: tests/helpers/synth-node.ts + tests/integration/audit-completeness.test.ts
US3: tests/helpers/disabled-scan.ts + tests/integration/audit-defect-ledger.test.ts
US4: tests/integration/audit-locality.test.ts
```

**US3 的補標記任務**（改不同測試檔，互不相干）：
```
T032 [P] arrays-pointers / types-advanced-ops / cstring
T033 [P] control-flow / variables-ops / strings / oop / cstdlib / advanced
T037 [P] stacks-queues / oop / variables-ops / types-advanced-ops 的 skip
```

## Implementation Strategy

**MVP = US1（中立性）**。理由：它是四條裡**唯一能改變路線圖決策**的——路線圖階段 7（Python）的核心目的是驗證語言無關性，而這條護欄用一條測試提前給出答案。做完 US1 就已經回答了「Python 該不該現在做」。

**增量交付順序**：

1. **Setup + Foundational**（T001–T007）→ 掃描規則可信
2. **US1**（T008–T012）→ **MVP，可停在這裡**
3. **US2**（T013–T024）→ 補完地圖，價值最高的單一產物
4. **US3**（T025–T038）→ 清償優先序；含最多人工判斷（約 76 個項目要分類）
5. **US4**（T039–T042）→ 進度計
6. **Polish**（T043–T047）→ 效能驗收與知識庫回填

**Git 紀律**（憲章 III）：每個 Phase 結束 commit；US 內部的「產生基線」任務（T011／T023／T038／T042）各自獨立 commit——基線的產生與後續每次調整都要在版本歷史中可見（FR-004）。

## Notes

- **本功能只量不修**：任何「順手把違規修掉」的衝動都超出範圍（spec Out of Scope）。T024 明確要求驗證後**還原**。
- **護欄第一天是紅字滿滿的報表，這是預期行為**。要求第一天綠等於沒有真的量（spec Assumptions）。
- **`[P]` 只標在不同檔案且無未完成相依的任務**；同檔任務一律序列。
