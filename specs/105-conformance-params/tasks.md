# Tasks: 符合性清償——函式族的參數

**Input**: [spec.md](spec.md) · [plan.md](plan.md) · [research.md](research.md)

**Tests**: 要求測試——護欄 #29 已經紅著（7 筆），它是這次的紅燈；分隔符的邊界要先寫測試再實作。

**紀律**：每顆元件一個 commit。任一步紅 → 整步 `git revert`，不在紅的狀態上手動補。

---

## Phase 1: Setup

- [ ] T001 錄六顆的來回基準 in `tests/integration/roundtrip-func-family.test.ts`：每顆一個**有參數**與一個**無參數**樣本，加上 `map<int,int>` 分隔符樣本與 `long long` 型別樣本
- [ ] T002 確認基準跑起來**是紅的**（6 顆的有參數樣本），並把紅的那幾筆逐項記進本檔

---

## Phase 2: Foundational — 機制（阻斷全部）

- [ ] T003 [P] 寫 `tests/unit/children-as-field.test.ts` 的邊界：`map<int,int> m, int k` 不得拆成三段、`long long n` 的型別是 `long long`、零參數不得產生空項、`void (*f)(int,int)` 與 `int a[10]` 要嘛正確要嘛**明確不支援**
- [ ] T004 實作 `src/core/projection/children-as-field.ts`：`serialize(children, spec)` 與 `parse(text, spec)`，分割時追蹤 `<>`／`()`／`[]` 深度
- [ ] T005 在 `src/core/types.ts` 的 `RenderMapping` 加 `childrenAsField?: ChildrenAsField[]`，與 `dynamicRules` 平行
- [ ] T006 `pattern-renderer.ts` 消費宣告：`childNodes.length === 0` 時**不寫欄位**（research R3）
- [ ] T007 `pattern-extractor.ts` 消費宣告：欄位空白時**不建立**子節點陣列（同上）
- [ ] T008 ⚠️ **驗證機制在無人宣告時是 no-op**：`npm test` 全綠且護欄數字**一筆未動**（仍是 7）

**Checkpoint**：機制就位，行為零改變

---

## Phase 3: User Story 1 — 六顆的參數不再消失 (P1) 🎯 MVP

**Goal**：六顆的來回樣本逐字相同，護欄 7 → 1。

- [ ] T009 [US1] `cpp:lambda` 加 `childrenAsField` 宣告 in `src/languages/cpp/core/blocks.json`
- [ ] T010 [US1] 驗：`[](int a, int b) { return a + b; }` 逐字相同；`[](){...}` 不得變成 `[]( )`；護欄 7 → 6 → **commit**
- [ ] T011 [US1] `cpp:constructor` 加宣告 → 驗 `C(int a) {}` → **commit**
- [ ] T012 [US1] `cpp:method_virtual` 加宣告 → 驗 → **commit**
- [ ] T013 [US1] `cpp:method_override` 加宣告 → 驗 → **commit**
- [ ] T014 [US1] `cpp:template_function` 加宣告 → 驗 → **commit**
- [ ] T015 [US1] `cpp:method_virtual_pure` 加宣告 → 驗（⚠️ research 未驗項：它**沒有 body 接點**，要確認缺 body 不影響渲染）→ **commit**
- [ ] T016 [US1] 護欄 #29 收數字：確定違規 = **1**，「無法確定」未上升；下調基線並在 `_meta` 註明是**實作變好**不是重新分類

**Checkpoint**：US1 完成，MVP 可交付

---

## Phase 4: User Story 2 — 加第七顆只要加宣告 (P2)

- [ ] T017 [US2] 合成測試：一顆**全新的**、宣告了 `params` 接點與 `childrenAsField` 的元件，只加宣告不改引擎，參數走得過來回
- [ ] T018 [US2] 反向：一顆有 `params` 接點但**沒寫**宣告的合成元件，必須被護欄報為違規（FR-003——沉默不得等於通過）

---

## Phase 5: User Story 3 — 數字要真的降 (P3)

- [ ] T019 [US3] 確認護欄 #29 的**判準一個字都沒改**（`git diff` 該檔為空），數字從 7 → 1 純粹是實作變好
- [ ] T020 [US3] 存檔版本仍是 v9，且有測試釘住「本次改動不需要遷移」（FR-007）

---

## Phase 6: Polish

- [ ] T021 瀏覽器實測（SC-007）：六顆在真實編輯器裡，參數在切語言前後一致
- [ ] T022 `npm test && npm run build` 收尾

---

## Dependencies

```
Phase 1 → Phase 2（機制）→ Phase 3（六顆，內部循序，每顆一個 commit）
                              → Phase 4（需要機制與至少一顆已宣告）
                              → Phase 5 → Phase 6
```

**可並行**：T003 與 T004 的撰寫順序不可反（測試先）；T009–T015 之間刻意**不並行**——每顆要在全綠上動下一顆，否則紅了無法歸因。

## Implementation Strategy

**MVP = Phase 1 + 2 + 3**（T001–T016）。到這裡六筆資料遺失就修好了，
而護欄的數字是它的機械證明。

Phase 4 是**防止第七顆重蹈覆轍**——沒有它，這次的修法只治了六顆，
而下一個加元件的人不會知道要寫那一行。
