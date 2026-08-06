---

description: "Task list for 050-repay-top-blockers"
---

# Tasks: 補回無聲丟失的資料，並讓缺陷帳量對

**Input**: Design documents from `/specs/050-repay-top-blockers/`

**Prerequisites**: plan.md、spec.md、research.md、data-model.md、contracts/、quickstart.md

**Tests**: 憲章 II（TDD 非妥協）全程適用。**US1 先寫失敗的測試再修**；**US2 交付的就是一支刻意失敗的測試**——它的紅色不是待補，是把已知缺陷釘在測試套件裡讓它出聲。

**Organization**: 依 User Story 分組，每組獨立可實作、可測試、可交付。

## Format: `[ID] [P?] [Story] Description`

- **[P]**：可平行（不同檔、無未完成相依）
- **[Story]**：US1–US4
- 每個任務都含確切檔案路徑

---

## Phase 1: Setup

**Purpose**: 本功能不需要新的基礎設施——三處都用既有機制。此階段只確認起點乾淨。

- [X] T001 執行 `npm test` 確認既有測試全綠，並記下四項量測的當前數字作為回歸基準（`tests/baselines/*.json`）

---

## Phase 2: User Story 1 — 陣列初始值不再無聲消失（Priority: P1）🎯 唯一改變系統行為的故事

**Goal**: `int arr[3] = {1,2,3}` 的初始值保留在語義結構中；做不到時**出聲**而不是無聲丟棄。

**Independent Test**: 單獨跑 `roundtrip-array-initializer.test.ts` 即可驗證，與其餘故事無依賴。

### 先紅：把兩個現象都釘住

- [X] T002 [US1] 在 `tests/integration/roundtrip-array-initializer.test.ts` 寫斷言：帶初始值的陣列宣告，其初始值必須出現在語義結構中（**此時應紅**——研究實測值會消失）
- [X] T003 [US1] 在同檔加斷言：**做不到時必須降信心並記原因**——目前 `int a[3]={1,2,3}` 標的是最高信心（**此時應紅**，這是本故事的核心，見 quickstart 情境 2）
- [X] T004 [US1] 在同檔加斷言：三態可區分——`int a[3];`（欄位不存在）／`int a[3]={};`（空陣列）／`int a[3]={1,2,3}`（有內容）
- [X] T005 [US1] 在同檔加斷言：走完「辨識 → 產生程式碼」一圈後初始值等價，涵蓋**數值、字元、字串、多維**（多維的層次不得壓平）

### 後綠：實作

- [X] T006 [US1] 在 `src/languages/cpp/core/lifters/strategies.ts` 為陣列宣告加上初始值分支：把初始值列表逐個辨識成 `values` 子槽（data-model 契約 1）
- [X] T007 [US1] 在同處實作多維：巢狀初始值列表遞迴成巢狀節點，**不壓平**
- [X] T008 [US1] 在同處實作可見降級：無法完整保留時降低該節點的信心等級並設降級原因——**用既有的 `ConfidenceLevel` 與 `DegradationCause`，不新增型別**
- [X] T009 [US1] 確認無初始值的陣列宣告行為**完全未變**（FR-006），跑既有測試驗證

**Checkpoint**: T002–T005 全綠 → US1 可獨立交付

---

## Phase 3: User Story 2 — 輸出構造走一圈之後還是同一個概念（Priority: P1）

**Goal**: 把「輸出概念 round-trip 後身分改變」這個現象**釘住**，讓它每次跑測試都出聲。

**Independent Test**: 單獨跑該測試，確認它紅、且訊息說得出身分是從哪個變成哪個。

> ⛔ **本故事不得改動 `src/`。** 要讓身分守住有兩條修法，兩條都會動到跨風格的既有行為（專案明列的已知坑）。實作時若想順手修，那是另一個功能。

- [X] T010 [US2] 在 `tests/integration/roundtrip-concept-identity.test.ts` 建立測試：一個「輸出」概念的最小節點走完「產生程式碼 → 重新辨識」一圈，斷言概念身分不變
- [X] T011 [US2] 讓失敗訊息**指出身分從哪個變成哪個**（FR-011），而非只說不相等
- [X] T012 [US2] 在該檔頂端寫明：**這支測試刻意是紅的**，它釘住一個已知缺陷；若它變綠，代表有人在本功能範圍外改了輸出行為
- [X] T013 [US2] 確認 `git diff` 中 `src/` **零改動**（FR-012）

**Checkpoint**: 測試存在且紅、訊息可讀 → US2 可獨立交付

---

## Phase 4: User Story 3 — 缺陷帳分辨「被關掉的測試」與「只有名字的測試」（Priority: P1）

**Goal**: 讓缺陷帳能回答「修哪個元件可以解鎖最多**已存在的**測試」——目前它答錯，因為把 64 個不存在的測試算了進去。

**Independent Test**: 重新量測後對照兩個新數字。

- [X] T014 [US3] 在 `tests/integration/audit-defect-ledger.test.ts` 先加斷言：報表必須分別呈現「有測試本體」與「只有名字」兩個數字（**此時應紅**）
- [X] T015 [US3] 在 `tests/helpers/disabled-scan.ts` 的 `DisabledEntry` 加 `hasBody`，判定方式為停用宣告後面有沒有 callback（`it.todo('x')` 無、`it.skip('x', () => {})` 有）
- [X] T016 [US3] 在 `tests/integration/audit-defect-ledger.test.ts` 實作兩類計數與報表區塊
- [X] T017 [US3] 收窄 `byBlocker` 的語義：**只統計有測試本體的項目**（FR-021）——只有那些「修好就能解鎖」
- [X] T018 [US3] 報表明確標示「只有名字」的項目需要的是**重新產生測試**，不是修缺口（FR-022）
- [X] T019 [US3] 讓兩個新數字各自成為只准下降的棘輪（FR-023）
- [X] T020 [US3] 更新 `tests/baselines/defect-ledger.json` 加入兩個新欄位；`total` **保留**以與舊基線可比較。**獨立 commit，訊息說明原因**（FR-024）

**Checkpoint**: 報表能回答「修哪個解鎖最多已存在的測試」→ US3 可獨立交付

---

## Phase 5: User Story 4 — 阻斷者歸因改對（Priority: P2）

**Goal**: 讓標記與逐筆註解一致；註解沒寫明的誠實標為待確認，而非沿用來自檔案層級推測的標記。

**Independent Test**: 抽查標記與註解的一致性。

- [X] T021 [US4] 在 `tests/helpers/disabled-scan.ts` 加入 `[UNVERIFIED]` 標記型別（contracts 契約 3）
- [X] T022 [US4] 在 `tests/integration/audit-defect-ledger.test.ts` 加斷言：`[UNVERIFIED]` 的**數量本身是棘輪**，只准下降——避免它變成新垃圾桶
- [X] T023 [US4] 重新歸因 `tests/integration/fuzz-cpp-string.test.ts` 的 10 筆：逐筆註解寫的是四種不同原因（條件中的賦值、const 遺失、vector 初始化列表、未支援的字串函式），**不是檔頭宣稱的同一個**
- [X] T024 [P] [US4] 重新歸因 `tests/integration/fuzz-cpp-arrays-pointers.test.ts`、`fuzz-cpp-cstring.test.ts`：逐筆註解已寫明原因的，標記與之一致
- [X] T025 [P] [US4] 重新歸因 `tests/integration/fuzz-cpp-cctype.test.ts`、`fuzz-cpp-cstdlib.test.ts`、`fuzz-cpp-containers.test.ts`、`fuzz-cpp-numeric.test.ts`
- [X] T026 [P] [US4] 重新歸因 `tests/integration/fuzz-cpp-control-flow.test.ts`、`fuzz-cpp-oop.test.ts`、`fuzz-cpp-types-advanced-ops.test.ts`、`fuzz-cpp-variables-ops.test.ts`、`fuzz-cpp-advanced.test.ts`、`fuzz-cpp-stacks-queues.test.ts`、`roundtrip-functions-io.test.ts`
- [X] T027 [US4] 確認重新歸因**未改變停用項目總數**（FR-032）——它只改標籤，不改狀態

**Checkpoint**: 標記與註解一致 → US4 可獨立交付

---

## Phase 6: Polish & Cross-Cutting

- [X] T028 依 `quickstart.md` 七個情境逐一驗收，特別確認情境 2（做不到會出聲）與情境 4（US2 釘住了現象）
  > **實作偏離**：情境 4 原訂「US2 的測試是紅的」，實作改用 `it.fails`——永久紅會讓「全套綠」失去意義，而四條護欄的價值全建立在那個訊號上。詳見該檔頂端說明。
- [X] T029 確認四項量測的數字皆未上升（`total` 因本功能不修阻斷者而不會下降，這是預期的）
- [X] T030 執行 `npm test` 確認既有測試全數維持通過
- [X] T031 更新 `knowledge/draft/2026-08-05-元件膠囊重構.md`：把「64 個 `it.todo`」的敘述更正為「85 筆停用項目，其中 21 筆有本體、64 筆只有名字」，並記錄 research 的 F1／F4／F5／F6 四個發現
- [X] T032 更新 `knowledge/experience.md`「量測工具的第一版會安靜地量錯」那條：補上**第三個實例**（本功能發現的分類語義錯），並補上它的新觸發點——**這類錯只有在你照它行動時才會現形**

---

## Dependencies

```
Phase 1 (T001)
    ↓
    ├─→ US1 陣列初始值 (T002–T009)   ← 唯一改變系統行為
    ├─→ US2 身分釘住   (T010–T013)   ← 不得動 src/
    ├─→ US3 缺陷帳分類 (T014–T020)
    └─→ US4 歸因改對   (T021–T027)   ← 需 T021 的標記型別
              ↓
        Phase 6 Polish (T028–T032)
```

**US1／US2／US3 完全獨立**，可任意順序或平行。**US4 需要 US3 的 T021**（標記型別在同一個 helper 檔）。

## Parallel Opportunities

**US4 的重新歸因**（改不同測試檔，互不相干）：

```
T024 [P] arrays-pointers / cstring
T025 [P] cctype / cstdlib / containers / numeric
T026 [P] control-flow / oop / types-advanced-ops / variables-ops / advanced / stacks-queues / roundtrip-functions-io
```

三個 Story 可同時開工（不同檔案）：

```
US1: src/languages/cpp/core/lifters/strategies.ts + tests/integration/roundtrip-array-initializer.test.ts
US2: tests/integration/roundtrip-concept-identity.test.ts
US3: tests/helpers/disabled-scan.ts + tests/integration/audit-defect-ledger.test.ts
```

## Implementation Strategy

**MVP = US1**。它是四個裡**唯一改變系統行為**的——修掉一個無聲丟值的 bug，讓學生寫 `int arr[3] = {1,2,3};` 時真的能得到正確結果。其餘三個改的是「我們對系統的認識」。

**建議順序**：

1. **T001** → 起點乾淨
2. **US1**（T002–T009）→ **MVP，可停在這裡**。先寫 T003（做不到要出聲）比先寫 T002 更重要——它讓紅色出現在正確的地方
3. **US3**（T014–T020）→ 讓量測工具量對，後續一切依賴它
4. **US4**（T021–T027）→ 讓它指對方向
5. **US2**（T010–T013）→ 釘住現象，最小
6. **Polish**（T028–T032）→ 驗收與知識庫回填

**Git 紀律**（憲章 III）：每個 Story 一組 commit；T020 的基線調整**獨立 commit**（契約要求可在版本歷史中看見）。

## Notes

- **US2 不得改動 `src/`**（T013 專門驗這件事）。想順手修的衝動要擋住——那會把跨風格的已知坑吞進本功能。
- **US1 先寫「做不到要出聲」再寫「做得到要做對」**。反過來的話，實作可以合法地在困難情形悄悄退回原狀而測試照樣綠。
- **US1 的驗證用真實程式碼走一圈，不用合成節點**——完備性護欄漏掉這個 bug 的原因正是它只跑合成的最小樣本。
- **本功能不會讓缺陷帳的 `total` 下降**。它修的是量測的正確性與一個無聲丟值的 bug，不是任何阻斷者的缺口。T029 已註明這是預期的。
