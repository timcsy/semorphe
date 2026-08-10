# Tasks: 積木型別從概念身分導出

**Feature**: `116-block-type-derive` ｜ **Spec**: [spec.md](spec.md) ｜ **Plan**: [plan.md](plan.md)

## ⚠️ 兩個硬性順序約束（違反了就補不回來）

1. **T004（錄 v9 存檔樣本）必須在任何改名之前。** 改完就錄不到真實的 v9 存檔了，
   而那份樣本是「舊檔還打得開」唯一的機械證據。
2. **護欄（T002）先蓋、確認紅、逐項指名，基線最後才產（T033）。**
   先產基線的話違規會被寫進基線變成「已知」，而**你永遠不會知道它們曾經存在**。

---

## Phase 1: Setup

- [ ] T001 量出今天的三個數字並寫進 `specs/116-block-type-derive/measured.md`：嚴格不導出 153、只差前綴 67、化石 86、已符合 33（`186 = 33+67+86`）。**這是後面每一步的對照基準**

## Phase 2: Foundational（阻斷全部使用者故事）

- [ ] T002 新增護欄 `tests/integration/audit-block-type-derive.test.ts`：量「專案宣告的積木裡，`blockDef.type` 不等於導出名」的筆數。⚠️ **範圍限定「專案宣告的積木」**，不是 Blockly 執行期 registry（使用者自訂積木沒有 conceptId，見 `contracts/derive-rule.md` 的邊界一節）
- [ ] T003 跑 T002，**確認它是紅的且報 153 筆並逐項指名**。⚠️ 一開始就綠有三種可能，沒有一種是好消息：判準寫錯、資料沒載入、或基線先產了。**此時不得產基線**
- [ ] T004 ⚠️ **在任何改名之前**：在瀏覽器裡建一份用到 `if`／`for`／`vector`／`cout`／`stack` 的程式，存檔，把 `localStorage['semorphe-state']` 的內容存成 `tests/assets/v9-savedstate.json`，並把當時的積木清單、產生的程式碼、執行輸出一併記進 `tests/assets/v9-savedstate.expected.md`
- [ ] T005 [P] 在 `src/core/component/` 新增導出規則的**單一實作** `derive-block-type.ts`：`derive(conceptId, form?)` → `:` 換 `_`，非預設形態接 `_` + `form.value`。⚠️ **`axis` 不進名字**（理由見 `contracts/derive-rule.md`：7/9 顆已在用這個形狀）
- [ ] T006 [P] 自證測 `src/core/component/derive-block-type.test.ts`：三種形狀各一例（預設／`role=expression`／`container_kind=stack`），**外加一條負向**——兩個形態導出同名時必須丟錯（不變式 I1）
- [ ] T007 護欄補一項：全部積木的導出名**必須唯一**（不變式 I1／I2）。今天實測不撞名，而那是事實不是保證
- [ ] T008 護欄的兩個注入方向（`build-guardrail` 第 9 步）：① 把一顆積木型別改成不導出的名字 → **會報且指名那一顆**；② 全部符合 → **不亂報**。⚠️ 基線是 0 的時候這是唯一的健康檢查
- [ ] T009 ⚠️ 檢查護欄的自我否證聲明**沒有錨在缺陷計數上**（`build-guardrail` 第 2 步的語法簽名：健康檢查裡不得出現 `expect(<缺陷計數>).toBeGreaterThan(0)`）——那種錨點會在這條規範成功的那天變紅

**Checkpoint**：護欄紅著、報 153、指得出名字；導出規則有單一實作且測過；v9 樣本已錄。

---

## Phase 3: User Story 1 - 舊存檔照樣打得開 (P1) 🎯 MVP

**目標**：一次性轉換掛上版本鏈，四個契約全過。
**獨立驗證**：`tests/assets/v9-savedstate.json` 載入後積木清單／語義樹／程式碼／輸出四者與 `.expected.md` 相同。

- [ ] T010 [US1] 在 `src/blocks/` 新增 `block-type-migrations.ts`——舊積木型別 → 新積木型別的**凍結明表**。⚠️ 照 `src/blocks/id-migrations.ts` 的形狀（它的檔頭寫著為什麼是明表不是規則：「那一版存在哪些名字是**歷史事實**」）。**先留空，由 T017／T022／T027 逐批填**
- [ ] T011 [US1] 在 `src/core/storage-version.ts` 加 v9 → v10 升級步驟。⚠️ **這是專案第一次改寫積木狀態**——既有八步每一步都只碰 `raw.tree`。改寫的目標寫成「積木狀態裡每顆積木的型別欄位」，**不是「所有叫 type 的欄位」**（Blockly 積木定義的 `args` 裡也有 `type`，字面一樣但完全無關，而兩邊都是 string、型別檢查看不到）
- [ ] T012 [US1] 未知型別要**出聲**（契約 C3）：轉換時遇到表上沒有的型別，回可辨識的失敗，**不得靜默丟棄那顆積木**
- [ ] T013 [P] [US1] 契約測試 `tests/integration/save-migration-v10.test.ts` 四支：C1 換得乾淨／C2 冪等／C3 未知型別出聲／C4 語義樹逐欄位不變
- [ ] T014 [P] [US1] 回歸測試：載入 `tests/assets/v9-savedstate.json`，比對積木清單、產生的程式碼、執行輸出三者與 `.expected.md` 相同。⚠️ **這一支讓「舊檔還打得開」每次跑測試都被驗證**，而不只在改名當天被人工確認一次
- [ ] T015 [US1] 確認匯入 JSON 那條路也走同一個升級入口（研究一實測是 ✅，但要有測試釘住——**兩處各寫一份會漂移**）

**Checkpoint**：US1 可獨立驗收。此時尚未改任何名字，轉換表是空的——四個契約在空表上仍必須成立。

---

## Phase 4: User Story 4 - 第三個名字進不來 (P2)

**目標**：護欄在改名之前就守著，讓後面每一批改完立刻看得見成果。
**獨立驗證**：故意寫一顆不導出的積木型別 → 紅且指名；改回來 → 綠。

> ⚠️ 這個故事排在改名**之前**，是 `build-guardrail` 的「護欄先蓋，功能後做」：
> 如果規範是為了配合重構才立的，把重構先做完，違規會被重構「順便」修掉
> ——**一個被順便修掉的缺陷不會留下任何紀錄，而它的同類還會再來。**

- [ ] T016 [US4] 確認 T002–T009 的護欄與注入都就位且紅著（153）。這一項是**檢查點不是新工作**——它存在是為了讓「護欄先於改名」在任務表上是一個可勾選的事實

---

## Phase 5: User Story 2 - 只差前綴的 67 顆 (P2)

**目標**：驗證整條管線最便宜的一段。
**獨立驗證**：不導出數 153 → 86，US1 的四個契約仍全過。

- [ ] T017 [US2] **先只改已膠囊化那 5 顆**（`cpp:char_is_alpha → cpp_isalpha`、三顆 `c_math_*`、`c_char_literal`）：改 `src/components/*/*/forms/blocks.json` 的 `blockDef.type`，並把舊 → 新填進 T010 的明表。⚠️ **這是 FR-011 的「先驗形狀再推量」**——上一次同類改名回退了 121 個檔
- [ ] T018 [US2] 跑全套。綠了才繼續。⚠️ 這 5 顆裡有 3 顆是 `c_math_*`，它們的積木型別出現在工具箱快照基線裡，會一起變
- [ ] T019 [US2] 改其餘只差前綴的 62 顆：`src/blocks/projections/blocks/universal-blocks.json` 與 `src/languages/cpp/**/blocks.json` 的 `blockDef.type`
- [ ] T020 [US2] 同步改**裸的物件鍵**（實測 155 處，大宗在 `src/ui/block-registrar.ts`）。⚠️ 這些是 Identifier 不是 StringLiteral，**AST 掃描器看不到**
- [ ] T021 [US2] 跑護欄，確認 153 → 86，且**下降的每一筆都指得出是哪一顆**（不是只看總數變小）

**Checkpoint**：US2 可獨立驗收；不導出數 86。

---

## Phase 6: User Story 3 - 86 顆化石詞彙 (P3)

**目標**：消滅雙重命名。
**獨立驗證**：不導出數 86 → 0；用命名整理的同一套判準量積木型別，「操作詞不在封閉詞彙」24 → 0、「裸的函式庫名」63 → 0。

- [ ] T022 [US3] 改 86 顆的 `blockDef.type` 與對應的裸物件鍵，逐批填進明表
- [ ] T023 [US3] ⚠️ **模板字串那一處手改**：`src/languages/cpp/std/cctype/generators.ts:8` 的 `` g.set(`cpp_${func}`) ``。**改名腳本掃不到它**——上一輪剛因為同一種形狀付過代價（兩顆概念的產生器從未存在，而 35 條護欄全部看不見）
- [ ] T024 [US3] `container_kind` 那兩顆（`c_stack_push`／`c_queue_push`／`c_stack_pop`／`c_queue_pop`）：導出後變成 `cpp_container_push_stack` 等。⚠️ 它們把 value 塞進**主體**而不是後綴，所以是**改名**不是保留
- [ ] T025 [US3] ⚠️ **若發現某一筆舊名有理由存在**（不是化石而是刻意的差異），**停下來記下來**，不要硬改。規格的 Assumptions 明說那是一個發現
- [ ] T026 [US3] 跑護欄，確認 86 → 0
- [ ] T027 [US3] 檢查明表：153 筆全部在裡面，每一筆看得見

**Checkpoint**：不導出數 0。

---

## Phase 7: 消費者改寫（⚠️ 不能更早也不能更晚）

> 早了會與舊前綴打架；晚了那段時間排序是壞的。

- [ ] T028 ⚠️ 把 `src/ui/toolbox-builder.ts:100-101` 的 `startsWith('u_')` 改成**問概念宣告的 `layer` 欄位**。改名之後沒有型別以 `u_` 開頭 → `universalIo` 恆為空、iostream／printf 的排序偏好**靜靜失效**。而那一行上方的註解記著它**已經害過一次**（三顆 `cpp_` 積木兩邊都不屬於，被排序函式靜靜丟掉）
- [ ] T029 [P] 測試釘住 T028：`iostream` 與 `printf` 兩種偏好下，IO 分類的積木順序各是什麼。⚠️ 影響面已量（`u_` 27 顆 ⊂ `layer=universal` 31 顆，差的 4 顆沒有一顆是 IO 類，預期行為改變為 0）——**但用測試釘住，不用推理代替**
- [ ] T030 掃一遍其餘「拿形狀當判斷」的地方：`startsWith('c_')`／`startsWith('cpp_')`／`endsWith('_expr')`。⚠️ **命名慣例不是契約**——要判斷「這顆是不是 X」就問宣告，不要看名字長什麼樣

---

## Phase 8: Polish & 驗收

- [ ] T031 ⚠️ **瀏覽器實測**（`quickstart.md` 第四節，這一步不能用測試代替）：貼 v9 存檔進 localStorage → 重整 → 看積木長出來了嗎、有沒有未知型別 → 按執行比對輸出 → 切 iostream/printf 看排序
- [ ] T032 更新受影響的既有基線：`tests/baselines/toolbox.json`（積木型別全變）、`dual-truth`、`component-locality` 等。⚠️ 每一個都要在 `_meta.note` 註明原因
- [ ] T033 **最後才產** `tests/baselines/block-type-derive.json`，`_meta` 註明下降是「**因為實作了**」而不是「因為重新分類」
- [ ] T034 `npm test` 全套綠
- [ ] T035 ⚠️ 記下 `component-rename` skill 的差異：它是為**身分**改名寫的，這次改的是**積木型別**。哪幾步適用、哪幾步不適用——那是該 skill 的下一次修正
- [ ] T036 更新 `knowledge/vision.md` 的 F1 段落為已完成，並反流：教訓 → `experience.md`、轉變 → `history/`、設計 draft 退場

---

## 依賴圖

```
T001 ─▶ T002 ─▶ T003（必須紅）
                  │
        T004（v9 樣本，⚠️ 改名之前）
                  │
        T005/T006（導出規則）─▶ T007/T008/T009（護欄補強）
                  │
                  ▼
        US1: T010…T015（轉換掛上版本鏈）
                  │
        US4: T016（檢查點——護欄先於改名）
                  │
                  ▼
        US2: T017/T018（膠囊 5 顆，驗形狀）─▶ T019/T020/T021（其餘 62）
                  │
                  ▼
        US3: T022…T027（86 顆化石）
                  │
                  ▼
        T028/T029/T030（消費者改寫，⚠️ 不能更早也不能更晚）
                  │
                  ▼
        T031（瀏覽器）─▶ T032/T033（基線最後）─▶ T034/T035/T036
```

## 平行機會

| 可平行 | 為什麼 |
|---|---|
| T005 ＋ T006 | 實作與其自證測不同檔 |
| T013 ＋ T014 | 兩支測試不同檔 |
| T029 與 T030 | 不同檔 |

⚠️ **改名的那幾批（T017/T019/T020/T022）不可平行**——它們碰同一批 JSON 與同一個明表。

## MVP 範圍

**US1（舊存檔照樣打得開）＋ Foundational**。那一段做完之後系統仍然是一個名字兩份宣告，
但**遷移管線已經驗過**——而那是這件事唯一不可逆的部分。
