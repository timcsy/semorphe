# Tasks：元件身分命名空間遷移

**Feature**: `specs/103-namespace-migration` ｜ **Plan**: [plan.md](./plan.md)

**執行順序是護欄先於資料**（plan 決策二）：棘輪要先有基線才量得到下降，
而 `build-guardrail` 第 6.5 步要求第一次跑必須紅。等資料改完再寫護欄，
只會得到一個「由建構保證的綠」——C1 剛付過這個學費。

---

## Phase 1：Setup

- [ ] T001 建立角色分類器 `tests/helpers/identity-refs.ts`：掃描 `src/` 與 `tests/` 的
      TypeScript 字串字面與 JSON 欄位，回報每一處的角色（`conceptId`／`blockType`／`非身分`）
      與檔案行號。JSON 側靠欄位位置（`conceptId`／`abstractConcept`／課程清單 vs `blockDef.type`），
      TS 側靠呼叫位置。檔頭必須寫明**已知低報**（變數指派、未列入的註冊函式）與
      「低報會讓棘輪提早喊零」這個後果
- [ ] T002 [P] 在 `src/core/identity.ts` 定義 scope 白名單（`lang`｜`cpp`）與
      `parseComponentId(id)`／`isNamespaced(id)`。白名單必須是明列清單，
      不是「任何冒號前的東西」——否則打錯字會變成一個新命名空間（FR-002）

---

## Phase 2：Foundational（阻擋所有後續段落）

⚠️ **這一階段結束時，兩條護欄都必須是紅的。** 綠代表它們沒接上。

- [ ] T003 新增護欄 `tests/integration/audit-identity-namespace.test.ts`，含兩個量測：
      **(a)** 身分格式違規顆數（FR-011，指名元件與檔案位置）
      **(b)** 舊格式引用數棘輪（FR-012，用 T001 的角色分類器，**不得用純字串比對**）
- [ ] T004 為 T003 補自我否證（FR-014）：注入一顆不含冒號的身分**必須被報出**；
      注入一顆 scope 不在白名單的身分**必須被報出**；注入一顆格式正確的身分
      **必須不被報出**；掃描器有真的掃到東西（第 10 步）
- [ ] T005 **第一次跑，確認它紅**：格式違規 **174 顆**、舊格式引用 **4657 處**。
      數字對不上就是分類器壞了，不是世界長那樣——停下來修 T001
- [ ] T006 新增第三個量測：JSON 裡 `blockDef.type` 落在身分清單中的處數，
      基線 **66**（SC-007）。這個數字**在整個遷移過程中不得變動**
- [ ] T007 寫入基線 `tests/baselines/identity-namespace.json`，接上棘輪
- [ ] T008 修 `src/languages/cpp/core/generators/statements.ts:46` 的複合鍵
      （`` `${n.conceptId}:${...}` ``）——身分含冒號後切法會曖昧。
      全樹只有這一處（contracts/identity-format.md）

---

## Phase 3：User Story 1 — 舊存檔打得開（P1）

**目標**：遷移不是資料破壞。
**獨立驗證**：一份 v2 存檔載入後，產出的程式碼與遷移前**逐字相同**。

- [ ] T009 [US1] 在 `src/core/storage-version.ts` 建立 v2→v3 轉換表（174 筆）與升級函式，
      沿用 v1→v2 的既有結構
- [ ] T010 [US1] 轉換必須**冪等**（`cpp:math_pow` 原樣通過）且**保守**
      （表裡沒有的身分原樣保留，不丟棄）——FR-006、FR-007
- [ ] T011 [US1] 轉換 **MUST NOT** 改寫 `blocklyState` 裡的積木型別（FR-008）
- [ ] T012 [US1] 在 `tests/unit/core/storage-version.test.ts` 補四支測試，對應
      spec 的四個 Acceptance Scenario（舊身分轉得動／冪等／不認得的保留／v3 不重轉）
- [ ] T013 [US1] `CURRENT_VERSION` 調成 3，確認既有那支
      「從 1 到 CURRENT_VERSION 的每一步都必須有註冊」測試仍然通過

---

## Phase 4：第 ① 段 — 142 顆 `cpp_*`（支撐 US3）

**為什麼先做 `cpp_`**：`cpp_foo` 不可能是英文字／DOM 標籤／tree-sitter 節點型別
→ **零誤報**，這是它可以機械改的唯一理由（research 發現二）。

- [ ] T014 [US3] JSON 側改寫：`conceptId`／`abstractConcept`／課程清單的 `cpp_*` → `cpp:*`，
      **靠欄位位置**，不碰 `blockDef.type`
- [ ] T015 [US3] TS 側改寫：`src/` 與 `tests/` 的 `'cpp_*'` 字面 → `'cpp:*'`，
      排除 `registerExtractStrategy` 等 blockType 位置
- [ ] T016 [US3] 跑 `npx tsc --noEmit` 與全套。**期待**：全綠、
      舊格式引用 4657 → **1438**、格式違規 174 → **32**、`blockDef.type` 維持 **66**
- [ ] T017 [US3] 若紅：**回退整段**，不要就地修補。分段的意義就是每段可獨立回退

---

## Phase 5：第 ② 段 — 32 顆裸名（支撐 US3）

⚠️ **不得用字串比對**（FR-010）。實測 878 筆未分類多為
`document.createElement('input')`、`node.type === 'comment'`、`rightNode.text === 'endl'`。
中立性護欄踩過同一個坑：**六筆裡三筆是誤報**（`experience.md:150`）。

- [ ] T018 [US3] 擴充 T001 的角色分類規則，涵蓋 research 發現四列出的兩類已知低報：
      變數指派（`concept = 'arithmetic'`）與未列入的註冊函式（`registerConceptMapping`）
- [ ] T019 [US3] 印出**殘留清單**（角色分類不到、但字串命中身分的每一處），**逐筆人看**，
      把判定與理由寫進護欄檔頭。這是硬性零之前唯一擋得住「提早喊零」的東西
- [ ] T020 [US3] 只改寫角色分類得出的位置：裸名 → `lang:*`（JSON 欄位 ＋ TS 角色位置）
- [ ] T021 [US3] 跑全套。**期待**：全綠、舊格式引用 1438 → **0**、格式違規 → **0**、
      `blockDef.type` 維持 **66**

---

## Phase 6：User Story 2 — 新增元件時格式不會退回去（P2）

- [ ] T022 [US2] 棘輪收**硬性零**（FR-013）：舊格式引用 = 0、格式違規 = 0
- [ ] T023 [US2] 護欄報表印出 scope 分佈（`lang` 32／`cpp` 145），讓「新增了一個
      沒人審過的 scope」看得見

---

## Phase 7：引用完整性複驗（跨切面）

- [ ] T024 [P] 驗 `abstractConcept` 指得到的比例**不得下降**（FR-015）。
      這一項容易漏，因為指向斷掉**不會有症狀**——它是「機制有了沒人接上」的第二個實例
- [ ] T025 [P] 驗「使用者拿不到的積木」維持 **0**（FR-016、SC-005）。
      課程清單漏遷移的症狀就是這個數字上升，而 E 項踩過一次：7 顆積木使用者拿不到、
      測試全綠
- [ ] T026 [P] 驗既有 25 條護欄的數字**一條都不上升**（SC-004）
- [ ] T027 驗 SC-003：一份遷移前存的檔案，載入後產出的程式碼**逐字相同**

---

## Phase 8：Polish

- [ ] T028 [P] 更新 `knowledge/vision.md`：D 標記完成，F 的依賴打勾
- [ ] T029 [P] 寫 `knowledge/history/031-D命名空間遷移.md`，記錄轉變與反流
- [ ] T030 評估 skill 化「遷移一顆元件身分」——knowie-next 已標為 skill 候選。
      判準：F 段還會不會重複這個操作。**不會就別建**（別建一個沒人用的機制）
- [ ] T031 ⚠️ **人要做的**：開瀏覽器確認工具箱分類與順序沒變、隨手拖幾顆積木產出正常。
      機器驗得了「身分還在」，驗不了「使用者看到的東西沒變」

---

## 依賴圖

```
Phase 1 (T001-T002)
   ↓
Phase 2 (T003-T008)  ← 護欄必須先紅
   ↓
Phase 3 US1 (T009-T013)  ← 存檔轉換要先能用，否則第 ① 段一改就破壞資料
   ↓
Phase 4 第①段 (T014-T017)   142 顆 cpp_
   ↓
Phase 5 第②段 (T018-T021)   32 顆裸名（依賴 ① 完成才量得準）
   ↓
Phase 6 US2 (T022-T023) ─┬─→ Phase 7 複驗 (T024-T027，可平行)
                          └─→ Phase 8 Polish (T028-T031)
```

## 可平行的

- T024／T025／T026 三項複驗互不相干
- T028／T029 兩份文件互不相干
- Phase 4 與 Phase 5 **不可平行**——① 沒做完，② 的棘輪數字沒有意義

## MVP 範圍

**Phase 1–4**（T001–T017）：護欄就位 ＋ 存檔轉換 ＋ 142 顆 `cpp_` 遷移完成。
到這裡舊格式引用已經從 4657 降到 1438，而且**每一步都可歸因**。
裸名那 32 顆風險完全不同，值得單獨一段。

## 這份清單刻意不做的事

- 不改積木型別（`u_*`／`c_*`）——B 項已定加法式保留
- 不落地 `hw:`／`@user:`——那些域還不存在
- 不做身分型別化——C3 已判定 branded type 攔不到打錯的 id，需 codegen，D 之後再評估
