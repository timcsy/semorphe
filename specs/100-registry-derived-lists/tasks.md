# Tasks：登錄表導出——使用者選得到的東西不該是手寫清單

**Feature**: `100-registry-derived-lists` ｜ **Plan**: [plan.md](plan.md) ｜ **Spec**: [spec.md](spec.md)

## ⚠️ 一條硬性順序（不可調換）

> **US1 的護欄（T004）必須在 US2 的導出（T016）之前全部做完並轉綠。**
>
> 先導出的話，實測到的 **7 顆拿不到的積木會被導出「順便」修掉**，
> 而我們永遠不會知道它們曾經存在。護欄先做，那 7 顆會被**指名**。

一個被順便修掉的缺陷不會留下任何紀錄——而它的同類還會再來。

## TDD 非妥協（constitution II）

每一個實作 task 前面那支測試**必須先真的紅過**。
T004 第一次跑**必須紅，且必須指名 7 顆**——它一開始就綠代表護欄壞了，不是世界變好了。

---

## Phase 1：Setup——先拍照，才有得比

- [ ] T001 建立 `tests/integration/toolbox-snapshot.test.ts`，用全部概念可見的登錄表產出完整工具箱（分類順序、標題、每個分類的積木順序），以 `GENERATE_BASELINE=1` 寫進 `tests/baselines/toolbox.json`
- [ ] T002 [P] 在同一支測試裡加課程清單快照：`cpp-beginner` 與 `cpp-competitive` 的 `levelTree`（每層的 id／label／concepts 順序），寫進 `tests/baselines/curriculum.json`
- [ ] T003 產基線並提交——**這是改動前的照片**，之後每一步都對照它

---

## Phase 2：US1 — 學生找得到每一顆積木（P1）

**目標**：補上系統缺的那一格檢查。**Independent test**：列出所有有積木投影的元件，逐一確認拿得到。

### 護欄先（必須紅）

- [ ] T004 [US1] 新增 `tests/integration/audit-toolbox-reachability.test.ts`（第十九條護欄）：
  - 從**實際載入後**的登錄表 ＋ `buildToolbox` 產出比對（不讀靜態設定——`build-guardrail` 第 4 步）
  - `visibleConcepts` 餵**全部概念**——⚠️ 規劃階段第一版就是餵單一 topic 而低估了數量
  - 違反分兩欄：**缺陷**（忘了）vs **明確排除**（`excludeTypes`／中性形態）
- [ ] T005 [US1] 在 T004 檔頭寫**自我否證聲明**（⚠️ 必須在寫量測邏輯**之前**寫，`build-guardrail` 第 2 步）：
  > 「如果這條護欄回報零違規，而合成注入的『沒有任何分類收它』的積木**沒有**被報出來，代表護欄壞了，不是工具箱完整。」

  ⚠️ 錨點**挑合成的，不挑真實世界的狀態**。同一個 session 裡錨點已經爛掉五次，
  最近一次就是錨在「確定桶非空」上，然後 B 項把它修到零。
  **護欄修好了它要量的東西，就是它的錨點爛掉的時候。**
- [ ] T006 [P] [US1] 雙向注入（`build-guardrail` 第 9 步，兩個方向都要）：合成一顆**沒有任何分類收它**的積木 → **必須被報出**
- [ ] T007 [P] [US1] 反向注入：合成一顆**有分類收它**的積木 → **必須不被報出**。⚠️ 沒有這一支的話，一個「什麼都報」的掃描器也能通過 T006
- [ ] T008 [US1] 釘住**理由**不只釘結果（第 8 步）：斷言 `cpp_ifstream_declare` 被歸為「缺陷」而 `c_container_push` 被歸為「明確排除」——**分錯桶但總數對**的護欄，看起來與健康的完全一樣
- [ ] T009 [US1] **跑它，確認紅，且逐字指名這 7 顆**：`cpp_getline`／`cpp_string_find_first_not_of`／`cpp_string_find_last_not_of`／`c_map_assign`／`cpp_istringstream_declare`／`cpp_ifstream_declare`／`cpp_ofstream_declare`

  ⚠️ 報 4 顆或 25 顆都是錯的——規劃階段那兩個數字各是一次量錯（見 research.md 更正）

### 補那 7 顆（轉綠）

- [ ] T010 [US1] `src/languages/cpp/toolbox-categories.ts`：`cpp_getline`、`cpp_ifstream_declare`、`cpp_ofstream_declare` 加進 `io` 分類。⚠️ `io` 走 `isIoCategory` 的特殊排序路徑，要確認 `buildIoContents` 收得到它們（不是加進 `extraTypes` 就好）
- [ ] T011 [P] [US1] `cpp_string_find_first_not_of`、`cpp_string_find_last_not_of` 加進 `text`
- [ ] T012 [P] [US1] `c_map_assign` 加進 `maps_sets`
- [ ] T013 [P] [US1] `cpp_istringstream_declare` 加進 `stacks_queues`（與既有的 `cpp_stringstream_declare` 同家；`<sstream>` 放這裡是既有的教學決定，**改它不在本功能範圍**）
- [ ] T014 [US1] 把三顆明確排除的寫成**宣告**而非省略：`c_container_push`／`c_container_pop`／`u_if_else` 各自附一行理由（與 `skipPaths` 同一種紀律——「忘了」與「刻意不放」必須分得出來）
- [ ] T015 [US1] 護欄轉綠；重拍 `tests/baselines/toolbox.json`——**這張才是 US2 要對照的照片**（改動前那張多了 7 顆，不是回歸）

---

## Phase 3：US2 — 加一顆元件不必編輯任何清單（P1）

**目標**：P3 的直接要求。**Independent test**：合成一顆新元件，不編輯任何清單，它自動出現。

⚠️ **T004–T015 全綠之前不准開始。**

- [ ] T016 [US2] 先寫會紅的那支：在 T004 護欄裡加 R-3 檢查——合成一顆元件宣告（概念＋積木投影＋模組歸屬），斷言它**自動**出現在對應分類。此刻必紅（現在靠手寫 `extraTypes`）
- [ ] T017 [US2] `src/languages/cpp/std/types.ts`：`StdModule` 加 `toolboxCategory?: string`（模組層級的預設歸屬）
- [ ] T018 [US2] `src/core/types.ts`：`BlockProjectionJSON`／`BlockSpec` 加 `toolboxCategory?: string`（逐顆覆蓋）。⚠️ `block-spec-registry.ts` 的 `loadFromSplit` 必須用**展開合併**（`...proj`）——097 就是逐欄建構把 `form` 靜默吃掉的，`experience.md:232` 已有處方
- [ ] T019 [US2] `src/ui/toolbox-builder.ts`：實作解析鏈 ①積木宣告 → ②模組宣告 → ③`registryCategories` 比對 `category`（data-model RS-1）
- [ ] T020 [P] [US2] 13 個**純的**模組各宣告一次 `toolboxCategory`：`algorithm`→arrays_lists、`cctype`→text、`cmath`→operators、`cstdio`→io、`map`→maps_sets、`numeric`→arrays_lists、`queue`→stacks_queues、`set`→maps_sets、`sstream`→stacks_queues、`stack`→stacks_queues、`string`→text、`utility`→maps_sets、`vector`→arrays_lists
- [ ] T021 [P] [US2] 兩個**散的**模組逐顆宣告：`cstdlib`（`abs`／`rand`／`srand`→operators、`exit`→control、`atoi`／`atof`→text）、`cstring`（`memset`／`memcpy`→pointers_memory，其餘→text）

  ⚠️ 實測 `c_memset`／`c_memcpy` 目前**同時出現在文字與指標與記憶體兩個分類**。導出後只會出現一次——這是產出的**唯一允許差異**，要在 T023 明確記下來，不能靠快照默默吸收
- [ ] T022 [US2] 刪掉 `toolbox-categories.ts` 裡**純字串**的 `extraTypes`（約 55 筆）。**帶 `extraState` 的三筆 `u_if` 保留**——那是教學設計，登錄表推不出來（EX-2）
- [ ] T023 [US2] 對照 T015 的基線逐項比對：分組、順序、成員一字不差，除了 T021 記下的那一筆重複消除。⚠️ **順序若被演算法接管，這一支是唯一會叫的**
- [ ] T024 [US2] T016 轉綠——合成元件自動出現，且**沒有編輯任何清單**

---

## Phase 4：US3 — 教學順序不被演算法決定（P1）

**目標**：課程清單的成員留在人手上。**Independent test**：改動前後逐項相同。

- [ ] T025 [US3] 新增 `tests/integration/audit-curriculum-coverage.test.ts`：`levelTree.concepts` 引用登錄表裡不存在的元件 → **紅**（TP-1）
- [ ] T026 [P] [US3] 同檔：未被任何課程收錄的元件 → **列出來，不算違規**（TP-2）。⚠️ 做成違規會逼出「為了讓護欄綠而亂塞課程」，那比不收錄更糟
- [ ] T027 [P] [US3] 雙向注入：合成一個引用幽靈元件的層級 → 必報；合成一個引用真元件的層級 → 必不報
- [ ] T028 [US3] 課程清單的**成員一顆都不動**，對照 T002 的基線確認

---

## Phase 5：量測——把「清單」與「實作」分開計

- [ ] T029 從 `tests/integration/audit-component-identity-review.test.ts` 抽出檔案分類到 `tests/helpers/file-classification.ts`（宣告／清單／實作／清冊）。⚠️ FC-1：**由路徑規則判定，不得是一份檔名清單**
- [ ] T030 [P] 分類本身要有雙向注入測試：合成路徑 `src/languages/cpp/topics/x.json` → 判「清單」；`src/core/foo.ts` → 判「實作」
- [ ] T031 `audit-component-identity-review.test.ts` 改用共用的分類（FC-2：兩份會漂移）
- [ ] T032 `audit-locality.test.ts` 改用共用的分類，課程清單歸「清單」不計入實作擴散
- [ ] T033 ⚠️ **就近性的數字會下降**——重拍基線時**必須註記下降原因是「重新分類」而非「實作」**。`history/018` 的直接處方：混在同一個數字裡的話，用改量測刷分數看起來會像進步

---

## Phase 6：Polish

- [ ] T034 全套 `npm test` 綠。⚠️ **不要用 `head` 看 FAIL 列**——截斷輸出等於沒有讀
- [ ] T035 [P] 十八條既有護欄逐條複查無一上升（就近性除外，理由已在 T033 註記）
- [ ] T036 [P] `npm run lint`
- [ ] T037 依 [quickstart.md](quickstart.md) 走一遍七個驗證步驟
- [ ] T038 **人工驗**：開瀏覽器看工具箱——順序還是教學順序嗎？新出現的 7 顆放對分類了嗎？

  ⚠️ 第二個問題**機器答不了**——護欄只保證「在某個分類裡」，不保證「在**對的**分類裡」

---

## 依賴圖

```
T001–T003 （拍照）
    ↓
T004–T009 （護欄，必須紅且指名 7 顆）
    ↓                            ← ⚠️ 硬邊：不可跨越
T010–T015 （補齊，轉綠，重拍照）
    ↓
T016–T024 （導出，對照 T015 的照片）      T025–T028 （課程清單）※ 可與導出並行
    ↓                                      ↓
    └──────────→ T029–T033 （量測分類）←───┘
                      ↓
                 T034–T038 （Polish）
```

## 並行機會

| 批次 | 可同時做 |
|---|---|
| 注入測試 | T006 ／ T007 |
| 補那 7 顆 | T011 ／ T012 ／ T013（T010 走 io 特殊路徑，單獨做） |
| 模組宣告 | T020 ／ T021 |
| 課程清單 | T025–T028 整批可與 Phase 3 並行 |

## MVP 範圍

**US1 單獨就有價值**：護欄 ＋ 補那 7 顆。使用者立刻拿得到 `<fstream>` 與 `getline`，
而且下一次「忘了加進工具箱」會**當場**變紅。US2／US3 是把它變成不會再犯。
