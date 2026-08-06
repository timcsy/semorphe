# Tasks：分辨概念身分與撞名字串

**Feature**: `059-concept-id-vs-lookalike` ｜ **Spec**: [spec.md](./spec.md) ｜ **Plan**: [plan.md](./plan.md)

> **順序不可反**（plan「實作順序」）：修量測 → 搬投影 → 才改分層。
> 每個 Phase 結束都要量一次、commit 一次，並記下數字落在「誤報」欄還是「搬走」欄。

---

## Phase 1：Setup

- [ ] T001 拍下目前的中立性違規清單，存為 `specs/059-concept-id-vs-lookalike/baseline-29.txt`，作為全程歸因的依據

---

## Phase 2：Foundational（阻擋所有 User Story）

- [ ] T002 在 `tests/helpers/component-scan.ts` 建立遮罩管線的接縫：把既有的 `maskAbstractTargets` 與新遮罩收攏成一個具名的 `maskNonIdentityPositions(src)`，並讓 `scanFile` 呼叫它

---

## Phase 3：User Story 1 — 護欄數的是身分，不是拼法（P1）

**目標**：中立性的數字不再含撞名雜訊。

**獨立測試**：餵一個確定不是身分、但拼法相同的字串給掃描函式，看它是否還被報出。

### 測試先行（憲章 II：MUST 先紅）

- [ ] T003 [P] [US1] 在 `tests/helpers/component-scan.test.ts` 寫注入測試：**真的身分引用必須仍被報出**（合成字串，不掃真實檔案）— FR-003
- [ ] T004 [P] [US1] 同檔寫反向注入：**型別位置（`type X = 'a' | 'b'`、`prop: 'a' | 'b'`）的字串不得被報出** — FR-004
- [ ] T005 [P] [US1] 同檔寫反向注入：**`new Field*('x')` 第一引數不得被報出** — FR-004
- [ ] T006 [US1] 確認 T003–T005 **全部先紅**，再往下做

### 實作

- [ ] T007 [US1] 在 `tests/helpers/component-scan.ts` 實作遮罩 A（型別位置）— research 決策 2
- [ ] T008 [US1] 同檔實作遮罩 C（`new Field*` 第一引數）— research 決策 2
- [ ] T009 [US1] 在 `tests/integration/audit-neutrality.test.ts` 的 `NOT_DETECTED` 加一句：**本護欄不檢測「語法層級的語言耦合」**——它只找概念身分字串，`lifter.ts` 剝 `//` 這種耦合它看不見 — research 決策 3
- [ ] T010 [US1] 同檔把報表改成**兩欄**：「誤報修掉的」與「真的搬走的」，兩欄不得只呈現相加後的總數 — FR-005
- [ ] T011 [US1] 同檔把自我否證聲明錨在合成注入上，不錨在真實檔案狀態上 — FR-006
- [ ] T012 [US1] **不得實作遮罩 B**（`.type === 'x'`）；在 `component-scan.ts` 留一段註解記下它被否決的理由與實測數字 — research 決策 2

### 驗收

- [ ] T013 [US1] 執行護欄，確認 **29 → 27**，且兩筆都落在「誤報」欄；重新產生基線並與本 Phase 一起 commit

---

## Phase 4：User Story 2 — 核心不再吐出 C 家族符號（P1）

**目標**：拔掉 C++ 之後，核心層產不出也剝不掉任何註解符號。

**獨立測試**：搜尋核心層，找不到註解語法符號。

### 測試先行（憲章 II：MUST 先紅）

- [ ] T014 [US2] 建 `tests/integration/comment-projection-snapshot.test.ts`：拍下單行／區塊／文件註解（含 `@brief`／`@param`／`@return` 各種組合）在三種積木風格下的產出 — 契約 2
- [ ] T015 [US2] 同檔加一支：**核心層零註解語法符號**（掃 `src/core/`）— FR-012。此時必須**紅**
- [ ] T016 [US2] 加一支：**沒有載入語言套件時產生註解**，行為必須明確、不得無聲產出空字串 — FR-014。此時必須**紅**

### 實作

- [ ] T017 [US2] 在核心建立宣告入口——語言套件推、核心讀，與 `src/core/skip-declarations.ts`／`language-executors.ts` 同形 — FR-011
- [ ] T018 [US2] 把 `registerMetaConceptGenerators` 裡的 `comment`／`doc_comment`／`block_comment` 三個產生器從 `src/core/projection/code-generator.ts` 搬進 C++ 語言套件 — FR-010
- [ ] T019 [US2] 把 `src/core/lift/lifter.ts:152` 剝 `//` 與 `/* */` 的邏輯搬進 C++ 語言套件 — FR-012、research 決策 3
- [ ] T020 [US2] 決定並實作「沒有語言套件」時的行為（語言中立預設 **或** 明說沒有語言套件），在 T016 中釘住選了哪一個 — FR-014

### 驗收

- [ ] T021 [US2] T014 的快照逐一比對，**一字不差** — FR-013
- [ ] T022 [US2] 執行護欄，確認 **27 → 24**，且三筆都落在「搬走」欄；重新產生基線並與本 Phase 一起 commit

---

## Phase 5：User Story 3 — 分類反映事實，且在搬完之後（P2）

**目標**：註解元件的層級反映「所有語言共有」。

**獨立測試**：改分類之前先確認語法已不在核心層。

- [ ] T023 [US3] 確認 Phase 4 已完成且核心層零註解語法——**這是 T024 的前置，不可跳過** — FR-021
- [ ] T024 [US3] 把 `comment`／`doc_comment`／`block_comment` 的 `layer` 從 `lang-core` 改為 `universal` — FR-020
- [ ] T025 [US3] 執行完備性護欄，確認那三個元件的五條路徑**沒有任何一條變成缺或殼** — FR-022
- [ ] T026 [US3] 執行中立性護欄，確認 **24 → 24**。**數字若下降，代表 Phase 4 沒搬乾淨**——那三筆是靠標籤消失的，不是靠搬走 — plan「實作順序」

---

## Phase 6：Polish

- [ ] T027 執行全套測試，確認全綠 — FR-030
- [ ] T028 執行其餘各條護欄，確認皆未上升 — FR-031
- [ ] T029 依 quickstart.md 逐條走一次

---

## 相依圖

```
T001 → T002 → Phase 3（US1）→ Phase 4（US2）→ Phase 5（US3）→ Phase 6
                    ↑ 順序不可反（FR-021、plan「實作順序」）
```

**US1／US2／US3 之間有真實相依**，不能平行：
- US2 的「搬走」欄要靠 US1 建的兩欄報表才量得出來
- US3 的「數字不動」驗證要靠 US2 先搬完才有意義

## 平行機會

只在 Phase 3 的測試先行階段：**T003／T004／T005** 三支注入測試互不相干，可同時寫。

## MVP

**Phase 3（US1）自成一個可交付的增量**——它獨立地讓中立性的數字可信，即使 Phase 4／5 沒做。這也是它排 P1 的理由：整個階段的優先序都建立在那個數字上。
