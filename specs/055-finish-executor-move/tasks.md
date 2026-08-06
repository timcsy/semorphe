---

description: "Task list for 055-finish-executor-move"
---

# Tasks: 把剩下的語言專屬執行器搬完

**Tests**: 憲章 II 全程適用。**兩條防線先於搬移。**

---

## Phase 1: 兩條防線

- [X] T001 `npm test` 全綠，記下七項量測
- [X] T002 擴充 `tests/integration/executor-inventory.test.ts`：加「**每個概念被註冊的模組必須與它在定義檔裡的歸屬一致**」（清冊比對抓漏失，這條抓錯置）
- [X] T003 建立 `tests/integration/audit-orphan-implementations.test.ts`：量「有實作但無宣告」的概念（**此時應為 4**）
- [X] T004 為 T003 產生基線並設棘輪；**獨立 commit**

**Checkpoint**: 漏失與錯置兩條防線就位

---

## Phase 2: User Story 2 — 攤開沒有宣告的實作（Priority: P1）

> **先做這個**：沒有宣告就沒有歸屬，硬搬是猜的。

- [X] T005 [US2] 補 `program` 的宣告（通用層）
- [X] T006 [US2] 補 `cpp_comma_expr` 的宣告（語言核心）
- [X] T007 [US2] 補 `var_declarator` 的宣告（語言核心）
- [X] T008 [US2] `compound_assign` **不搬不刪**，在 `research.md` 記下三種角色與待決狀態，並確認它出現在 T003 的量測裡
- [X] T009 [US2] 跑完備性，記錄補宣告後**新暴露的缺口**——照實，不隱瞞（FR-013）

**Checkpoint**: 4 個都有處置與依據

---

## Phase 3: User Story 1 — 56 個搬出核心（Priority: P1）

- [X] T010 [P] [US1] `io.ts` 的 3 個 → `std/cstdio/executors.ts`
- [X] T011 [US1] 執行引擎內嵌的 18 個 → `<cstdlib>` 6、`<algorithm>` 6、`<numeric>` 5、`<utility>` 1
- [X] T012 [US1] `variables`／`control-flow`／`functions`／`operators`／`arrays`／`mutations`／`literals` 的 35 個 → 語言核心，**通用的留下**
- [X] T013 [US1] 每搬完一組跑 T002（清冊 + 落點），集合與落點都必須正確
- [X] T014 [US1] 執行中立性護欄，記錄下降**可歸因到哪些概念**

**Checkpoint**: 核心只剩通用執行器與已知缺口清單

---

## Phase 4: User Story 3／4 — 盲點的執行機構與行為驗證（Priority: P2／P1）

- [X] T015 [US3] 報表**兩個方向都呈現**：有宣告無實作、有實作無宣告
- [X] T016 [US3] 新增「有實作無宣告」時檢查失敗並指名
- [X] T017 [US4] 完備性的執行欄「缺」未增加（補宣告造成的新增另計）
- [X] T018 [US4] 重複註冊未增加
- [X] T019 [US4] `npm test` 全綠

---

## Phase 5: Polish

- [X] T020 下調 `neutrality.json`；**獨立 commit，說明下降來自哪些概念**
- [X] T021 確認其餘量測未上升
- [X] T022 更新 `knowledge/vision.md`：記錄本輪下降與**新暴露的缺口**
- [X] T023 回填 `knowledge/experience.md`／`concepts/執行機構.md`——候選：「護欄只問了一個方向」

---

## Dependencies

```
Phase 1 (T001–T004 兩條防線)
    ↓
Phase 2 US2 補宣告 (T005–T009)   ← 必須先於搬移：沒宣告就沒歸屬
    ↓
Phase 3 US1 搬移 (T010–T014)
    ↓
Phase 4 US3/US4 (T015–T019)
    ↓
Phase 5 Polish (T020–T023)
```

## Notes

- **T002 的落點檢查是這次新增的防線。** 上一輪差點被錯置咬到（拆分工具把兩筆註冊併成一塊，集合不變）。這次搬 56 個、跨 9 個檔，機會更大。
- **T008 不刪 `compound_assign`。** 三種角色三種含義，查不清楚時方向是保留。**攤開比猜對重要。**
- **T009 的新缺口不得隱瞞。** 補宣告會讓殼變多——那是把既有問題攤開，不是退步，但報表要分得出來。
