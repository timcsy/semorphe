# Tasks: 目標（target）

**Input**: [plan.md](plan.md)、[research.md](research.md)、[spec.md](spec.md)

**Organization**: 依 User Story 分階段。

🔴 **而這個排序在動手時被推翻了**（research Q4）：沒有任何既有欄位標得出
「這是 C」，所以規則只能錨在**具名的 id** 上。→ 實際做的順序是 **US2/US1 先**。

⚠️ **而 US1 只做了一半**：C **風格**接上選單（10/10 因此拿得到），
**而 `Target` 本身的選單沒做**——見 T013／T015。

---

## Phase 1: Setup

- [X] T001 記下基準：`npm test` 4195、護欄 46、`c-style-parity` **6/10**
- [X] T002 🔴 跑 `c-style-parity`，**逐段指名那 4 段是哪 4 段、各自的錯誤**
      —— ⚠️ 沒有指名就修不到點（`build-guardrail` 6.5：「先跑、確認紅、**逐項指名**」）

---

## Phase 2: User Story 3 - C 的產出真的編得過 (P1) 🔴 先做

**Goal**: `c-style-parity` 6/10 → 10/10。
**Independent Test**: 同一批程式用 C 風格產出，餵給 C 編譯器。

- [X] T003 [US3] 在語言套件建**標頭名對映**（5 筆，research Q2 數過）
      —— 🔴 **逐筆寫進測試**，不靠編譯結果反推（「編得過的漏網最危險」）
- [X] T004 [US3] 產生器按風格決定標頭名（`header_style` 已存在，**不新增機制**）
- [X] T005 [US3] `struct` 標籤：C 風格時加，C++ 不加——一個 `if`
- [X] T006 [US3] 🔴 `c-style-parity` 轉 **10/10**
- [X] T007 [US3] ⚠️ **反方向**：C++ 那一側**不得退步**（spec US3 場景 2）
- [X] T008 [US3] ⚠️ 確認 C 產出的 C++ 專屬寫法**仍為零**（場景 3，今天已成立）

---

## Phase 3: User Story 2 - 它不是一個新的抽象層 (P1)

- [X] T009 [US2] `src/core/types.ts` 加 `Target`：**四欄，兩個引用兩個標籤**
- [X] T010 [US2] `src/core/target-registry.ts`——⚠️ **照 `topic-registry` 的形狀**，
      用**注入**不用 import（中立性護欄禁「核心 import languages/」）
- [X] T011 [US2] 🔴 **檢查點（SC-005）**：逐欄位列出「它今天住在哪裡」。
      **說不出來的即為新機制** → 那時停下來重新設計，不要硬加

---

## Phase 4: User Story 1 - 選一次而不是三次 (P1)

- [X] T012 [US1] `src/languages/cpp/targets/{cpp,c}.json` 兩筆資料
- [ ] 🔴 T013 [US1] UI：選目標 → 同時設 topic 與 style
      —— ⚠️ **沒做**。本輪接的是 **C【風格】** 進選單（那讓 10/10 拿得到），
      **而 `Target` 本身還沒有 UI**。下一輪。
- [X] T014 [US1] 🔴 **沒有選目標時行為與今天完全相同**（FR-005，硬條件）
- [ ] ⚠️ T015 [US1] 目標指向不存在的課程清單 → 說出來
      —— **沒做**（`tests/unit/target.test.ts` 只斷言**今天那兩筆指得到**，
      而**沒有一條路徑會在執行期檢查**）。跟著 T013 走。
- [X] T016 [US1] ⚠️ 切換兩個**風格**用同一棵樹投影兩次
      —— ✅ 而那是 `c-style-parity` **本來就有的形狀**（「反向」那一支）。
      🔴 **而「切換 target」那一版沒做**，因為 target 還沒有 UI。

---

## Phase 5: Polish

- [X] T017 🔴 中立性護欄：`total` 仍是 **0**
- [X] T018 全套 `npm test` ＋ 46 條護欄，基線**一個數字不動**
- [X] T019 `findings.md`：坑逐條，含「因為知道答案而跳過的」
- [X] T020 知識反流：`experience` / `history` / `vision` 收束階段 6.10，
      ⚠️ 而 `draft/C和C++難分難捨` **做完才退休**

---

## Dependencies

```
Setup(T001-002) → US3(T003-008)   🔴 先做，價值獨立於 target
                → US2(T009-011)   🔴 T011 是檢查點，可能中止本輪
                → US1(T012-016)
                → Polish(T017-020)
```

⚠️ **T002 → T003 不可換**（沒指名就修不到點）。
⚠️ **T011 有權中止本輪**——那是它存在的理由。

## MVP

**US3 單獨就是淨賺**（10/10 而不需要 target）。US2＋US1 才是機制本身。
