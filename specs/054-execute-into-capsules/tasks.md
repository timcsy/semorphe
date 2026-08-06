---

description: "Task list for 054-execute-into-capsules"
---

# Tasks: 執行那一路搬回它的模組

**Input**: Design documents from `/specs/054-execute-into-capsules/`

**Prerequisites**: plan.md、spec.md、research.md、data-model.md、contracts/、quickstart.md

**Tests**: 憲章 II（TDD 非妥協）全程適用。**搬移前的基準必須先固定。**

**Organization**: 依 User Story 分組。

## Format: `[ID] [P?] [Story] Description`

- **[P]**：可平行（不同檔、無未完成相依）
- **[Story]**：US1、US2、US3

---

## Phase 1: Setup 與**搬移前的基準**

> ⚠️ **T002 必須在任何搬移之前完成。搬完才想比對就沒有基準了。**

- [X] T001 執行 `npm test` 確認全綠，記下七項量測作為回歸基準
- [X] T002 建立 `tests/integration/executor-inventory.test.ts` 與 `tests/assets/executor-inventory.json`：把**目前**執行引擎認得的所有概念寫成固定清單，並斷言現況與它相同（**此時應綠**）
  > 失敗訊息必須說得出**少了誰／多了誰**，不能只說「集合不同」
- [X] T003 加斷言：集合**不得多**出來——多出來代表重複註冊（既有護欄在看的病）

**Checkpoint**: 基準固定 → 可以開始搬

---

## Phase 2: Foundational — 模組介面加第五面牆（阻斷所有搬移）

- [X] T004 在 `src/languages/cpp/std/types.ts` 為 `StdModule` 加 `registerExecutors`，**必填不是選填**（data-model 契約 1）
  > 選填會讓忘記接上的模組靜靜地少一條路。編譯器擋得住的東西不要留給人。
- [X] T005 為既有 11 個模組補上 `registerExecutors`——**還沒有執行器的先給空函式並註明原因**（顯式的空與遺漏的空要分得出來）
- [X] T006 在 `src/languages/cpp/std/index.ts` 的聚合處接上 `registerExecutors`
- [X] T007 在 `src/languages/cpp/generators/index.ts` 的語言載入流程推送執行器——與既有的宣告推送同一個形狀
- [X] T008 跑 T002，確認集合**仍然完全相同**（此時還沒搬任何東西，只是多了一條推送路徑）

**Checkpoint**: 第五面牆的形狀就位，尚未搬移 → 各模組可獨立開工

---

## Phase 3: User Story 1 — 58 個搬回它們的模組（Priority: P1）

**Goal**: 語言中立性下降；模組的五面牆齊。

**Independent Test**: 每搬完一個模組跑一次 T002，集合必須不變。

### 單一模組（整份對應，最單純）

- [X] T009 [P] [US1] `cmath.ts` 的 3 個 → `src/languages/cpp/std/cmath/executors.ts`
- [X] T010 [P] [US1] `pointers.ts` 的 8 個 → `src/languages/cpp/core/executors/pointers.ts`（指標是語言核心，不屬任何標準函式庫）

### 跨模組（要拆，FR-003）

- [X] T011 [US1] `strings.ts` 拆成兩份：`std/string/executors.ts`（17）與 `std/cstring/executors.ts`（10）
  > **不得整份塞進 `std/string`**——只用 `<cstring>` 的程式會連帶載進 `<string>` 的執行器
- [X] T012 [US1] `containers.ts` 的 13 個依概念拆進 `std/{vector,queue,map,set,stack}/executors.ts`
- [X] T013 [US1] `containers.ts` 剩的 7 個跨容器泛用操作 → `src/languages/cpp/core/executors/containers.ts`（research F2：它們的家本來就在核心）

### 收尾

- [X] T014 [US1] 刪除 `src/interpreter/executors/{strings,containers,pointers,cmath}.ts`
- [X] T015 [US1] 移除 `src/interpreter/interpreter.ts` 中對那四份的匯入與註冊呼叫
- [X] T016 [US1] 執行中立性護欄，確認數字下降，並記錄**下降可歸因到哪些概念**（FR-005）

**Checkpoint**: T002 集合不變 + 中立性下降 → US1 可獨立交付

---

## Phase 4: User Story 2 — 行為一字不差（Priority: P1）

**Goal**: 證明這是純搬移。

- [X] T017 [US2] 跑完整測試套件，確認既有測試全數通過
- [X] T018 [US2] 執行完備性護欄，確認執行那一欄的「缺」**未增加**（FR-012）
- [X] T019 [US2] 執行重複註冊護欄，確認**未增加**（FR-013）
- [X] T020 [US2] 依 quickstart 情境 2 驗拆分：只載入單一模組時，不得連帶載進另一個模組的執行器

**Checkpoint**: 三項量測皆未惡化 → US2 可獨立交付

---

## Phase 5: User Story 3 — 忘了載入語言套件時說得出原因（Priority: P2）

- [X] T021 [US3] 加一支測試：沒載入語言套件時執行語言概念，錯誤訊息含「可能是沒有載入語言套件」（**此時應紅**）
- [X] T022 [US3] 加一支測試：已載入時該提示**不出現**，行為與現況相同
- [X] T023 [US3] 在 `src/interpreter/executor-registry.ts` 加 `hasAnyExecutor()`
- [X] T024 [US3] 在未知概念的錯誤路徑補上那句提示——**判準是「註冊表是空的」，不是「概念名長得像 C++」**（後者又會讓核心去認識語言）

**Checkpoint**: 訊息說得出原因 → US3 可獨立交付

---

## Phase 6: Polish & Cross-Cutting

- [X] T025 依 `quickstart.md` 八個情境逐一驗收，**特別是情境 0 與情境 2**
- [X] T026 手動驗情境 3 的執行機構：拿掉某模組的 `registerExecutors` → **應該編不過**
- [X] T027 下調 `tests/baselines/neutrality.json`；**獨立 commit，訊息說明下降來自哪些概念**
- [X] T028 確認其餘六項量測未上升
- [X] T029 執行 `npm test` 確認全綠
- [X] T030 更新 `knowledge/vision.md`：記錄中立性的第二次下降，並註明這次是**純搬移**（與 053 的「4 個真修好 + 12 個說清楚」不同性質）
- [X] T031 回填 `knowledge/experience.md`——**只在真的有新東西時才寫**。候選：「用檔名推歸屬會錯」（research F1）

---

## Dependencies

```
Phase 1 (T001–T003 基準)         ← 阻斷所有搬移
    ↓
Phase 2 Foundational (T004–T008) ← 第五面牆的形狀
    ↓
    ├─→ US1 搬移 (T009–T016)     ← T009/T010 可平行；T011–T013 動同一批來源檔
    └─→ US3 訊息 (T021–T024)     ← 與搬移無關，可先做
              ↓
        US2 驗證 (T017–T020)     ← 需搬移完成才量得準
              ↓
        Phase 6 Polish (T025–T031)
```

**US3 完全獨立**，可先做。**US2 必須在 US1 之後**——它量的是搬完之後的狀態。

## Parallel Opportunities

```
T009 [P] cmath   → std/cmath
T010 [P] pointers → core/executors
```

⚠️ T011–T013 都改 `containers.ts`／`strings.ts` 與 `interpreter.ts` 的匯入，**實際上要序列化**。

## Implementation Strategy

**MVP = T009 + T010**（單一模組對應的兩份）。它們最單純、不需拆分判斷，做完就能驗證整條接線是通的——**接線錯了要在搬 27 個之前發現，不是之後**。

**建議順序**：

1. **T001–T003** → 基準固定
2. **Phase 2**（T004–T008）→ 第五面牆的形狀，**且此時集合必須仍然不變**
3. **T009／T010** → **MVP，驗證接線**
4. **T011–T013** → 兩份跨模組的拆分
5. **T014–T016** → 收尾與量測
6. **US2**（T017–T020）→ 證明是純搬移
7. **US3**（T021–T024）→ 訊息
8. **Polish**（T025–T031）

**Git 紀律**：每個 Story 一組 commit；T027 的基線**獨立 commit**。

## Notes

- **T002 必須最先。** 搬完才想比對就沒有基準了——這是這個功能唯一無法事後補救的一步。
- **T008 是被低估的一步**：Phase 2 只加了推送路徑、還沒搬任何東西，此時集合**必須完全不變**。變了代表接線本身出錯，而那個錯會被後面的搬移蓋掉。
- **T011／T012 不得偷懶整份塞。** 塞在一起的話，只用 `<cstring>` 的程式會連帶載進 `<string>` 的執行器——**那是把碎裂換成耦合，不是修好**。
- **T024 的判準不能用概念名。** 「名字以 `cpp_` 開頭就提示」會讓核心重新認識語言，等於把剛搬走的東西搬回來。
- **T031 允許不寫。** 沒有新教訓時硬寫一條是稀釋。
