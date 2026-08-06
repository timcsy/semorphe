---

description: "Task list for 052-storage-integrity-gate"
---

# Tasks: 存檔層的無聲遺失——欄位守恆與版本閘門

**Input**: Design documents from `/specs/052-storage-integrity-gate/`

**Prerequisites**: plan.md、spec.md、research.md、data-model.md、contracts/、quickstart.md

**Tests**: 憲章 II（TDD 非妥協）全程適用。**每個 Story 都先寫紅的測試再實作。**

**Organization**: 依 User Story 分組，每組獨立可實作、可測試、可交付。

## Format: `[ID] [P?] [Story] Description`

- **[P]**：可平行（不同檔、無未完成相依）
- **[Story]**：US1–US4
- 每個任務都含確切檔案路徑

---

## Phase 1: Setup 與**設計前提的實測驗證**

**Purpose**: 起點乾淨，**並且驗證 US3 的設計不是建立在讀錯的程式碼上**。

> ⚠️ **T002 是這個功能最重要的一個任務。** research F3 的「拒絕→刪除」四步鏈是**推理**，每一環都查證了程式碼，但**沒有實際跑過**。跑不出來就代表有一環讀錯了，**US3 要重新設計，不要照著寫**。

- [ ] T001 執行 `npm test` 確認既有測試全綠，記下五項量測的當前數字作為回歸基準（`tests/baselines/*.json`）
- [ ] T002 在 `tests/integration/storage-refusal-safety.test.ts` 寫一支**證明現況會刪資料**的測試：放一份不合法的存檔 → 觸發 `load()`（得到 `null`）→ 觸發 `save()` → 斷言**原資料已經被預設值覆蓋**。此測試在修好前應**通過**（它斷言的是缺陷存在）
  > 跑不出來 → **停下來**，回頭改 research F3 與 US3 的設計，不要繼續

---

## Phase 2: Foundational — 判定模組（阻斷所有 Story）

**Purpose**: `judge` 是 US1／US2／US3 共同依賴的地基。**兩條讀取路徑必須共用它**，這是 contracts 的唯一性要求。

- [ ] T003 建立 `src/core/storage-version.ts`，匯出 `CURRENT_VERSION = 1`、`SAVED_STATE_FIELDS`（用 `satisfies Record<keyof Required<SavedState>, 1>`）、`UPGRADES: Record<number, Upgrade> = {}`（**刻意為空，不寫任何升級函式**）
- [ ] T004 在 `tests/unit/core/storage-version.test.ts` 寫斷言：`SAVED_STATE_FIELDS` 的鍵集合恰為 11 個且與 `SavedState` 一致（**此時應綠**——編譯器已保證，這支測試守的是「有人把 `satisfies` 拿掉」）
- [ ] T005 在 `src/core/storage-version.ts` 實作 `judge(raw: unknown): VersionVerdict`，四種結果：`ok` / `needs-upgrade` / `too-new` / `not-a-save`（data-model 契約 3）
- [ ] T006 在 `src/core/storage.ts` 為 `LoadOutcome` / `RefusalReason` 定義型別，**`refused` 分支必填 `backedUpTo`**（data-model 契約 2）——「拒絕了但沒備份」必須編不出來

**Checkpoint**: 判定模組可獨立測試 → US1–US3 可開工

---

## Phase 3: User Story 1 — 選了的東西下次還在（Priority: P1）🎯 唯一使用者現在看得到的

**Goal**: `blockStyleId` 與 `locale` 存得進去也載得回來；**任何**新增欄位忘記接上時會出聲。

**Independent Test**: 單獨跑 `storage-fields.test.ts`，與其餘故事無依賴。

### 先紅

- [ ] T007 [US1] 在 `tests/unit/core/storage-fields.test.ts` 寫斷言：存一份**填滿 11 個欄位**的狀態，讀回來逐欄位比對（**此時應紅**——`blockStyleId` 與 `locale` 是 `undefined`）
- [ ] T008 [US1] 在同檔讓失敗訊息**指名是哪個欄位**（FR-003），不得只說「不相等」
- [ ] T009 [US1] 在同檔加斷言：選填欄位「未提供」與「提供了但為空」可區分（FR-004）

### 後綠

- [ ] T010 [US1] 在 `src/core/storage.ts` 把 `save()` 的逐欄位列舉改為展開合併：`{...DEFAULTS, ...existing, ...definedOnly(state), version, lastModified}`（data-model 契約 5）。`DEFAULTS` 型別標註為 `SavedState`，讓編譯器強制每個必填欄位都在
- [ ] T011 [US1] 實作 `definedOnly()`：濾掉值為 `undefined` 的欄位，避免「這次沒提供」抹掉「上次存的」
- [ ] T012 [US1] 確認額外的未知欄位隨 `...existing` 被保留（FR-017 的一半）

**Checkpoint**: T007–T009 全綠 → US1 可獨立交付。**這是 MVP。**

---

## Phase 4: User Story 2 — 不相容的存檔會出聲（Priority: P1）

**Goal**: 三種版本情況三種結果，兩條讀取路徑判定一致。

**Independent Test**: 單獨跑 `storage-version.test.ts`。

### 先紅

- [ ] T013 [US2] 在 `tests/unit/core/storage-version.test.ts` 加斷言：版本高於當前 → 拒絕（**此時應紅**——目前接受）
- [ ] T014 [US2] 在同檔加斷言：版本低於當前且無升級路徑 → 拒絕；有升級路徑 → 升級後載入（用合成的 `UPGRADES` 項目驗，**不得寫進生產程式碼**）
- [ ] T015 [US2] 在同檔加斷言：版本等於當前 → 正常載入，**行為與現況完全相同**（FR-013／FR-042）
- [ ] T016 [US2] 在同檔加斷言：`{hello:'world'}`／`'not json'`／`{version:'abc'}`／缺必填欄位 → 全部 `not-a-save`（**此時應紅**）
- [ ] T017 [US2] 在同檔加斷言：合法存檔**多帶**一個不認得的欄位 → **必須通過**，且下次存檔後該欄位仍在（FR-017）
- [ ] T018 [US2] 在同檔加斷言：`load()` 與 `importFromJSON()` 對**同一份輸入**得到相同判定（FR-010）——這是「不得各自實作」的執行機構

### 後綠

- [ ] T019 [US2] 在 `src/core/storage.ts` 實作 `loadOutcome()`：讀原始字串 → `judge()` → 依判定分支
- [ ] T020 [US2] 把 `load()` 改為 `loadOutcome()` 的相容包裝（`loaded`／`migrated` 回 state，其餘回 `null`）——**簽章不變**
- [ ] T021 [US2] 把 `importFromJSON()` 改為經由同一個 `judge()`；`version` 從「檢查存在」變為「檢查值」
- [ ] T022 [US2] 實作逐版升級：從存檔版本套用到 `CURRENT_VERSION`，每步查 `UPGRADES`；缺任一步 → `no-upgrade-path`；升級丟例外或產出仍不合形狀 → `upgrade-failed`，**不得產出半升級的狀態**
- [ ] T023 [US2] 加一支測試釘住 FR-016：從 1 到 `CURRENT_VERSION` 的每一步都必須有註冊。`CURRENT_VERSION=1` 時恆真；改成 2 而沒註冊 `UPGRADES[1]` 時**必須變紅**
- [ ] T024 [US2] 確認 `tests/unit/core/storage.test.ts` 四支**一支都沒改**（FR-042 的證據）

**Checkpoint**: T013–T018 全綠 → US2 可獨立交付

---

## Phase 5: User Story 3 — 拒絕不等於丟掉（Priority: P1）

**Goal**: 被拒絕的存檔原封不動；使用者看得到「有一份存檔沒載入」。

> ⛔ **依賴 T002 的結論。** 若 T002 跑不出刪除鏈，本 Story 的設計要先重做。

### 先紅

- [ ] T025 [US3] 在 `tests/integration/storage-refusal-safety.test.ts` 加斷言：拒絕 → 觸發自動存檔 → **原始內容仍完整存在於備份鍵**（**此時應紅**）
- [ ] T026 [US3] 在同檔加斷言：備份寫入失敗時，**主鍵保持不動**且仍回報 `refused`（寧可讓使用者看到失敗，也不冒險）

### 後綠

- [ ] T027 [US3] 在 `src/core/storage.ts` 實作備份：拒絕前先把原始字串寫入 `semorphe-state.rejected`（覆蓋式，只留一份），**寫成功才回報 `refused`**（data-model 契約 6）
- [ ] T028 [US3] 在 `src/ui/app.ts` 的 `restoreState()` 把 `if (!state) return` 改為依 `LoadOutcome` 的 `kind` 分支：`empty` 靜默返回（維持現況），`refused` 呼叫 `showToast(訊息, 'warning')`
- [ ] T029 [US3] 訊息內容要說得出「有一份存檔沒有載入」與**原因**（版本較新／無升級路徑／格式不符），不得只說「載入失敗」
- [ ] T030 [US3] 確認同一份被拒絕的存檔**不會每次操作都重複打擾**——一次工作階段只提示一次

**Checkpoint**: T025–T026 全綠 → US3 可獨立交付。**US1+US2+US3 = 完整的安全修復**

---

## Phase 6: User Story 4 — 這件事以後不會再悄悄退步（Priority: P2）

**Goal**: 第六條護欄，形式與既有五條同形。

**Independent Test**: 單獨跑護欄即得報表與基線。

- [ ] T031 [US4] 建立 `tests/integration/audit-storage-integrity.test.ts`，量三類違規：欄位不守恆數、兩條路徑判定不一致數、缺升級路徑步數（contracts 護欄契約）
- [ ] T032 [US4] **先寫失效樣態聲明再寫量測**（順序不可反——寫完量測再補聲明，會照著已看到的結果去寫它）：「如果『欄位不守恆』在修好之前不是 2，代表本護欄壞了，不是欄位沒問題」
- [ ] T033 [US4] 寫「本護欄**不檢測**什麼」聲明：存檔內容的語義正確性、localStorage 以外的後端、存檔前先讀舊檔再合併造成的污染傳播
- [ ] T034 [US4] 實作自我驗證測試，**釘住的是理由不只是結果**（FR-033）：不只斷言 `blockStyleId` 被報為不守恆，還要斷言報出的**原因**是「存入後讀回為 undefined」
  > 051 的 FR-022 通過了卻沒擋住錯誤結論，因為它只釘結果。**一個因為錯誤理由而給出正確結果的護欄，看起來與健康的完全一樣。**
- [ ] T035 [US4] 產生 `tests/baselines/storage-integrity.json`（`GENERATE_BASELINE=1`），三個數字皆成為只准下降的棘輪。**獨立 commit**（憲章 III）
- [ ] T036 [US4] 棘輪失敗時必須**指名是哪一項**退步，不得只說「數字變大了」

**Checkpoint**: 報表可讀、基線在位 → US4 可獨立交付

---

## Phase 7: Polish & Cross-Cutting

- [ ] T037 依 `quickstart.md` 九個情境逐一驗收，**特別是情境 0**（刪除鏈跑得出來）與情境 5（拒絕不等於丟掉）
- [ ] T038 手動驗情境 6：把 `CURRENT_VERSION` 改成 2 → 測試變紅 → 改回來
- [ ] T039 確認五項既有量測數字皆未上升
- [ ] T040 執行 `npm test` 確認既有測試全數維持通過
- [ ] T041 更新 `knowledge/concepts/執行機構.md`：「同一個形狀出現五次」表的第五列補上執行機構，五列**全部補完**
- [ ] T042 更新 `knowledge/vision.md`：階段 6.5 的阻斷前置「P5 之前補存檔版本閘門」標為完成，並記錄實測基線
- [ ] T043 把本輪的教訓回填 `knowledge/experience.md`——**只在真的有新東西時才寫**。候選：「逐欄位列舉 vs 展開合併」是「偵測 vs 消除」的一個實例；以及 T002 那種「先證明缺陷存在再修」的做法

---

## Dependencies

```
Phase 1 (T001, T002 ← 設計前提驗證)
    ↓
Phase 2 Foundational (T003–T006 判定模組)  ← 阻斷所有 Story
    ↓
    ├─→ US1 欄位守恆   (T007–T012)   ← MVP，唯一使用者現在看得到的
    ├─→ US2 版本閘門   (T013–T024)
    └─→ US3 拒絕安全   (T025–T030)   ← 依賴 T002 的結論
              ↓
        US4 護欄       (T031–T036)   ← 需 US1–US3 的行為定案才量得準
              ↓
        Phase 7 Polish (T037–T043)
```

**US1／US2 完全獨立**，可平行。**US3 需要 T002 的結論**（設計是否成立）。**US4 必須最後**——它量的是前三者修完之後的狀態，提前量會量到中間態。

## Parallel Opportunities

Phase 2 完成後，三個 Story 動不同檔案：

```
US1: src/core/storage.ts (save)          + tests/unit/core/storage-fields.test.ts
US2: src/core/storage.ts (load/import)   + tests/unit/core/storage-version.test.ts
US3: src/core/storage.ts (備份) + src/ui/app.ts + tests/integration/storage-refusal-safety.test.ts
```

⚠️ 三者都碰 `src/core/storage.ts`，**實際上要序列化**。標示為概念上獨立（各自可單獨驗收），不是可同時編輯。

## Implementation Strategy

**MVP = US1**。它是四個裡**唯一修掉使用者現在看得到的問題**的——學生切了積木外觀，重新整理後它還在。其餘三個修的是「改格式那天不會出事」。

**建議順序**：

1. **T001–T002** → 起點乾淨，**且 US3 的設計前提被驗證**
2. **Phase 2**（T003–T006）→ 判定模組，所有人的地基
3. **US1**（T007–T012）→ **MVP，可停在這裡**
4. **US2**（T013–T024）→ 閘門本體
5. **US3**（T025–T030）→ 安全網。**必須在 US2 之後**——沒有拒絕就不需要備份
6. **US4**（T031–T036）→ 護欄，量修完之後的狀態
7. **Polish**（T037–T043）

**Git 紀律**（憲章 III）：每個 Story 一組 commit；T035 的基線**獨立 commit**。

## Notes

- **T002 不是形式**。它是唯一一個「跑不出來就要回頭改設計」的任務。research F3 是推理鏈，實作的第一步就是把它變成實測。
- **T032 的順序不可反**。先寫失效樣態聲明再寫量測——反過來的話，你會照著已經看到的結果去寫那句聲明，它就失去了否證能力。
- **US3 必須在 US2 之後**，因為在有拒絕之前沒有東西需要備份。反過來做的話，備份程式碼沒有觸發路徑可以驗。
- **T024 是零行為改動的證據**，不是形式檢查。既有四支測試要是需要修改，就代表動到了不該動的東西。
- **T043 允許不寫**。如果本輪沒有產生新的教訓，硬寫一條是稀釋，不是累積。
