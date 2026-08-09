# Tasks: F 膠囊搬家——第一顆垂直切片

**Input**: [spec.md](spec.md) · [plan.md](plan.md) · [research.md](research.md) · [data-model.md](data-model.md) · [contracts/capsule.md](contracts/capsule.md) · [quickstart.md](quickstart.md)

**Tests**: 本 feature **要求**測試——它的主體就是護欄與防線（FR-004～FR-014）。

**紀律**：每個 Phase 結束時 `npm test` 必須全綠。任一步紅 → **整步 `git revert`**，
改工具再來；不在紅的狀態上手動補（`skills/component-rename` 步驟 4）。

---

## Phase 1: Setup

- [ ] T001 建立膠囊路徑常數與型別骨架 in `src/core/capsule/types.ts`（`CapsuleManifest`、`CapsuleRegistration`、`CAPSULE_ROOT = 'src/components'`）
- [ ] T002 [P] 建立 `src/components/.gitkeep` 與 `src/components/README.md`（說明「一顆元件一個資料夾」與 scope 分層）

---

## Phase 2: Foundational — 基準與護欄（阻斷所有 User Story）

> ⚠️ **順序不可反**：護欄先於搬家。搬家會「順便」修掉違規，而**被順便修掉的缺陷
> 不留紀錄**（`build-guardrail` 6.5）。

### 基準（步驟 0）

- [ ] T003 寫「搬家前基準」錄製器 in `tests/integration/capsule-move-parity.test.ts`：錄下 (a) 系統認得的全部 conceptId 集合、(b) `cpp:vector_declare` 五路可及性、(c) 該元件的產生碼／執行結果／來回轉換、(d) 該元件的 16 筆標籤字串
- [ ] T004 產出基準檔 in `tests/baselines/capsule-parity-vector-declare.json` 並進版控

### 防線（FR-007／008／009）

- [ ] T005 實作**防線一：集合比對**（抓「漏失」）in `tests/integration/capsule-move-parity.test.ts`
- [ ] T006 實作**防線二：註冊來源核對**（抓「錯置」）in `tests/integration/capsule-move-parity.test.ts`——斷言宣告裡的 `componentId` 與從路徑推導的來源一致，**兩者都要且互相核對**
- [ ] T007 在該檔頂端寫下**兩條防線各自抓不到什麼**（FR-009）：集合比對抓不到錯置（054 前例：兩筆註冊併進錯模組，集合完全相同、防線全綠）；來源核對抓不到來源標記本身被寫錯

### 護欄（FR-010～FR-014）

- [ ] T008 蓋膠囊就近性護欄 in `tests/integration/audit-capsule-locality.test.ts`——**正向**：已膠囊化的元件，其 componentId 不得出現在自己資料夾外的非清單類檔（FR-010）
- [ ] T009 加**反向**檢查到同一支護欄（FR-011）：膠囊資料夾內不得出現別顆元件的 componentId
- [ ] T010 加**標籤那一維**（FR-012）：已膠囊化元件的標籤鍵不得留在共用 i18n 檔——今天沒有任何護欄看得到這一維
- [ ] T011 加護欄的自我驗證兩向（`build-guardrail` 步驟 9）：注入一個假的違規必須報；注入一個正確的膠囊必須不報
- [ ] T012 寫「本護欄不檢測什麼」聲明（`build-guardrail` 步驟 3）：不檢測語義正確性、不檢測標籤有沒有說出「作用在哪裡」、不檢測跨元件的組合正確性
- [ ] T013 **執行護欄，確認它是紅的**，並把違規**逐項指名**寫進 `slice-record.md`（FR-013）。⚠️ 綠代表判準寫錯／資料沒載入／基線先產了——三種都不是好消息
- [ ] T014 產基線 in `tests/baselines/capsule-locality.json`，`_meta` 註明「維度與現行就近性不同（宣告＋實作＋標籤 vs 只算實作），數字不得與 3.46 相比」（FR-014）

### 膠囊機制（零膠囊時是 no-op）

- [ ] T015 實作膠囊登錄表 in `src/core/capsule/registry.ts`：掃描 `src/components/**/component.json`、驗 C1–C4、記錄 `CapsuleRegistration`
- [ ] T016 實作標籤合併 in `src/core/capsule/labels.ts`：合併各膠囊的 `labels/<locale>.json`，**鍵撞了 throw**（不得後者覆蓋前者）
- [ ] T017 [P] 單元測試 in `tests/unit/capsule-registry.test.ts`：C1–C4 各一個違規案例必須 throw
- [ ] T018 [P] 單元測試 in `tests/unit/capsule-labels.test.ts`：鍵相撞必須 throw，不得靜默覆蓋

**Checkpoint**：全套測試綠（護欄除外——它應該紅著，因為 177 顆都還沒搬）

---

## Phase 3: User Story 1 — 把一顆元件搬進它自己的資料夾 (P1) 🎯 MVP

**Goal**：`cpp:vector_declare` 的 8 個落點 → `src/components/cpp/vector_declare/`，行為零改變。

**Independent Test**：全套綠 ＋ 五路輸出與來回轉換逐字相同 ＋ 該顆在自己資料夾外的非清單類檔數 = 0。

### 步驟 4：搬宣告

- [ ] T019 [US1] 建 `src/components/cpp/vector_declare/component.json`——**原封搬**`std/vector/concepts.json` 裡那一筆，加 `requires: ["<vector>"]` 與 `paths`（五路全列，沒有的寫 `null` ＋ `_why`）
- [ ] T020 [US1] 建 `src/components/cpp/vector_declare/forms/blocks.json`——原封搬 `std/vector/blocks.json` 裡那一筆
- [ ] T021 [US1] 從 `src/languages/cpp/std/vector/concepts.json` 移除該筆（4 → 3）
- [ ] T022 [US1] 從 `src/languages/cpp/std/vector/blocks.json` 移除該筆（4 → 3）
- [ ] T023 [US1] 接上膠囊登錄到既有的宣告載入路徑（`src/languages/cpp/std/index.ts` 或 registry 匯入點），確認 `owner` 章仍是 `<vector>`
- [ ] T024 [US1] `npm test` 全綠 ＋ 防線一綠 → **commit（可還原單位）**

### 步驟 5：搬標籤

- [ ] T025 [P] [US1] 建 `src/components/cpp/vector_declare/labels/zh-TW.json`（8 筆，鍵不改名）
- [ ] T026 [P] [US1] 建 `src/components/cpp/vector_declare/labels/en.json`（8 筆）
- [ ] T027 [US1] 從 `src/i18n/zh-TW/blocks.json` 與 `src/i18n/en/blocks.json` 各刪那 8 筆
- [ ] T028 [US1] 接上 `core/capsule/labels.ts` 到 `src/i18n/loader.ts` 的載入路徑
- [ ] T029 [US1] `npm test` 全綠 ＋ 標籤字串與基準逐字相同 → **commit**

### 步驟 6：搬 generate 與 execute

- [ ] T030 [US1] 建 `src/components/cpp/vector_declare/generate.ts`——從 `std/vector/generators.ts` **剪下**該顆的註冊（含初始化列表那段與它的註解）
- [ ] T031 [US1] 建 `src/components/cpp/vector_declare/execute.ts`——從 `std/vector/executors.ts` 剪下該顆的註冊（含初始值接管那段與它的註解）
- [ ] T032 [US1] `npm test` 全綠 ＋ **防線二指出這兩路的來源是膠囊** → **commit**

### 步驟 7：搬 lift（R1 的卡點）

- [ ] T033 [US1] 把 `src/languages/cpp/core/lifters/strategies.ts:652` 的 `containerConcepts` 硬編表改成讀一份登錄表
- [ ] T034 [US1] 建 `src/components/cpp/vector_declare/lift.ts`——登錄 `{ template: 'vector' }`
- [ ] T035 [US1] 為其餘 6 顆容器建**過渡表**（明確標記「尚未膠囊化」，附退場條件），⚠️ 不得改變它們的行為
- [ ] T036 [US1] `npm test` 全綠 ＋ **七顆容器的 lift 行為逐一比對基準** → **commit**

### 步驟 8：自證測

- [ ] T037 [US1] 寫 `src/components/cpp/vector_declare/spec.test.ts`——**正向**：`vector<int> v = {3,1,4}` 來回轉換不動點、`v.size()` 執行得 3
- [ ] T038 [US1] 同檔**負向**（FR-004）：`array<int,3> a` 或 `stack<int> s` **不得**被認成 `cpp:vector_declare`
- [ ] T039 [US1] 同檔斷言**真的碰到這顆元件**（FR-005）：語義樹裡確實出現 `cpp:vector_declare`，不只驗輸出字串

### 步驟 9：收數字

- [ ] T040 [US1] 執行膠囊護欄，確認該顆「自己資料夾外的非清單類檔數」= **0**（8 → 0，SC-001）
- [ ] T041 [US1] 下調 `tests/baselines/capsule-locality.json`，`_meta` 註明是**第一顆膠囊化**造成的下降
- [ ] T042 [US1] 驗**可拆性**（SC-006）：`mv src/components/cpp/vector_declare /tmp/` → 只有該顆相關測試紅，其餘 176 顆零失敗；驗完搬回
- [ ] T043 [US1] 驗**兄弟元件**（research.md 未驗項）：跑同時用到 4 顆的程式，輸出與基準逐字相同
- [ ] T044 [US1] 驗**未搬的 176 顆擴散度一筆都沒變差**（SC-004）：`tests/baselines/locality.json` 無需下調也無需上調
- [ ] T045 [US1] 驗**身分沒變**（FR-016）：存檔版本仍是 v9，且有測試釘住「搬家 ≠ 改名」

**Checkpoint**：US1 完成，MVP 可交付

---

## Phase 4: User Story 2 — 護欄的雙向與盲區補完 (P2)

**Goal**：護欄能對人為製造的三類違規變紅。

**Independent Test**：三個注入各自變紅並指名。

- [ ] T046 [US2] 注入測試：把該顆的一行實作加回 `strategies.ts` → 護欄紅並指名元件與檔案（US2 場景 1）
- [ ] T047 [US2] 注入測試：在膠囊資料夾裡放一個屬於 `cpp:vector_size` 的東西 → 護欄紅並指名那個外來身分（US2 場景 2）
- [ ] T048 [US2] 注入測試：把該顆的一筆標籤加回共用 i18n 檔 → 護欄紅（US2 場景 4、SC-008）
- [ ] T049 [US2] 確認三個注入的**報錯理由各不相同**（`build-guardrail` 步驟 8：釘理由不只釘結果——一個因為錯誤理由而給出正確結果的護欄，看起來與健康的完全一樣）

**Checkpoint**：US1 + US2 完成

---

## Phase 5: User Story 3 — 成本與卡點紀錄 (P3)

**Goal**：答得出剩餘 176 顆的範圍與形狀分類。

- [ ] T050 [US3] 寫 `specs/104-capsule-vertical-slice/slice-record.md`：每一步的實際動作、耗時、卡點
- [ ] T051 [US3] 量出**形狀分類**：掃全部 177 顆，數出「lift 靠 pattern 而非顯式 lifter」「無執行器」「多形態」「宣告與兄弟共用陣列」各幾顆，**附查詢方式**（可重跑）
- [ ] T052 [US3] 給出剩餘 176 顆的範圍估計，**標明它基於幾個樣本**（FR-019）
- [ ] T053 [US3] 列出 `component-encapsulate` skill 該收的步驟，**每一步指回切片裡真的發生過的一次操作或卡點**（US3 場景 2）——沒發生過的不得寫進去

---

## Phase 6: Polish

- [ ] T054 [P] 瀏覽器實測（`quickstart.md` §五）：工具箱分類、標籤、語言切換、`#include <vector>`。⚠️ 測試綠不代表使用者看到的是對的，而標籤那一維剛脫離舊護欄
- [ ] T055 [P] 更新 `knowledge/vision.md` 的 F 進度（1/177）
- [ ] T056 執行 `npm test && npm run lint` 收尾

---

## Dependencies

```
Phase 1 (T001–T002)
   ↓
Phase 2 (T003–T018)  ← 阻斷全部；護欄必須先紅
   ↓
Phase 3 (T019–T045)  ← US1，內部嚴格循序（步驟 4→5→6→7→8→9）
   ↓
Phase 4 (T046–T049)  ← US2 需要一顆已膠囊化的元件當注入標的
   ↓
Phase 5 (T050–T053)  ← US3 需要切片跑完才有成本可記
   ↓
Phase 6 (T054–T056)
```

**Phase 3 內部不可並行**——每一步都要在全綠的狀態上動下一步，否則紅了無法歸因。

**可並行的少數**：T002、T017/T018、T025/T026、T054/T055。

## Implementation Strategy

**MVP = Phase 1 + 2 + 3**（T001–T045）。到這裡就有一顆真的膠囊、一條雙向護欄、
兩條防線，以及「8 → 0」這個可驗的數字。

Phase 4 是護欄的可信度（沒有它，護欄的綠不代表什麼）。
Phase 5 是這個切片**存在的理由**——不做的話，剩下 176 顆仍然是憑感覺開票。
