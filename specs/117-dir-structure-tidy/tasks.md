# Tasks：目錄結構的四件小整理（Phase 0 後剩兩項）

**Spec**: [spec.md](spec.md) ｜ **Plan**: [plan.md](plan.md) ｜ **Research**: [research.md](research.md)

⚠️ **原本的四項被 Phase 0 砍成兩項**——② 合併遷移表與 ④ `ui/` 分層都被查證否決，
理由見 `plan.md` 開頭。**不要照 spec 的原始四項做。**

## 這份清單的節奏

本功能**不新增行為**，所以它的 Red/Green 是「搬之前全綠 → 搬之後仍全綠」。
既有的 **3956 支 vitest ＋ 6 支 e2e** 就是那條紅線。

> **每一個搬移之後立刻跑 `tsc`，每一組之後跑全套。**
> 一次搬兩個檔然後才跑，紅了要花兩倍時間才知道是哪一個。

**import 清點**（實測，tasks 依此排序）：

```
blocks/universal              29 檔 import  ← 最大
blocks/block-input-names       3 檔
blocks/block-type-migrations   2 檔
blocks/id-migrations           1 檔
blocks/merged-identities       1 檔
```

---

## Phase 1：Setup

- [ ] T001 記錄搬移前的基準：`npx vitest run` 的通過數與 `npm run test:e2e` 的通過數，寫進本檔末尾的「基準」欄

## Phase 2：US3 — 視圖的驗證假設不再需要一個頂層目錄（P2，風險最低先做）

**獨立測試標準**：`src/views/` 消失後，「不靠 Blockly 也能做視圖」這件事仍有測試在保護。

- [ ] T002 [US3] 確認 `tests/unit/core/view-registry.test.ts` 的假視圖確實覆蓋「不依賴 Blockly 的視圖」這個性質——**若沒有，先補，再搬**
- [ ] T003 [US3] 把 `src/views/semantic-tree-view.ts` 的 `SemanticTreeView` 併進 `tests/unit/views/semantic-tree-view.test.ts`（它是那支測試的 fixture，不是可重用 helper）
- [ ] T004 [US3] 刪除 `src/views/` 目錄
- [ ] T005 [US3] `npx tsc --noEmit` ＋ `npx vitest run` 全綠 → commit

## Phase 3：US1 — 一個新來的人打開 `src/blocks/`（P1）

**獨立測試標準**：`src/blocks/` 消失，五個檔各在說得出理由的位置，全套綠。

⚠️ **順序由 import 數由小到大**——最大的那個（`universal`，29 檔）留到最後，
那時前面幾步已經證明搬移流程本身沒問題。

- [ ] T006 [US1] `src/blocks/merged-identities.ts` → `src/migrations/`（1 處 import：`core/storage-version.ts`）
- [ ] T007 [US1] `src/blocks/id-migrations.ts` → `src/migrations/`（1 處 import）
- [ ] T008 [US1] `src/blocks/block-type-migrations.ts` → `src/migrations/`（2 處 import）
- [ ] T009 [US1] ⚠️ **凍結明表的內容驗證**：`git diff -M --stat` 確認 T006–T008 三個檔是
      **rename 而非 rewrite**（相似度 100%）。若 git 判定為 modify，逐字比對找出被改動的字元。
      **這一步不可與 T006–T008 合併**——它是獨立的驗證，不是搬移的尾巴（見 requirements.md 的 Notes）
- [ ] T010 [US1] `npx tsc --noEmit` ＋ `npx vitest run` 全綠 → commit
- [ ] T011 [US1] `src/blocks/block-input-names.ts` → `src/core/block-input-names.ts`（3 處 import）
      ⚠️ 它住核心側是**檔頭明說的**（`specs/057`），搬到 `core/` 是把位置對齊那句話
- [ ] T012 [US1] `npx tsc --noEmit` ＋ `npx vitest run` 全綠 → commit
- [ ] T013 [US1] `src/blocks/universal.ts` → `src/languages/universal.ts`（**29 處 import**）
      ⚠️ 它 import `./projections/blocks/universal-blocks.json`——**相對路徑要跟著改**
- [ ] T014 [US1] `npx tsc --noEmit` ＋ `npx vitest run` 全綠 → commit
- [ ] T015 [US1] 刪除 `src/blocks/`（含 `projections/`、`semantics/` 兩個空目錄）
- [ ] T016 [US1] 確認 `find src -type d -empty` 回傳空 → SC-001

## Phase 4：驗收

- [ ] T017 `npx tsc --noEmit` 無錯誤 → SC-005
- [ ] T018 `npx vitest run` 通過數 **≥ 基準** → SC-006
- [ ] T019 `npm run test:e2e` 6 支全綠 → SC-007
- [ ] T020 ⚠️ **SC-008 存檔實測**：造一份舊版存檔（v9 或更早）載入，
      確認積木與程式碼都正確還原。**測試綠不代表使用者的存檔升得上來**
      ——T006–T008 動的正是升級路徑上的三份表
- [ ] T021 更新 `knowledge/vision.md` 的 roadmap 項目：勾完成，
      並**記下四項被砍成兩項這件事**（那是這個 spec 最有價值的產出）
- [ ] T022 反流：`draft/2026-08-12-目錄結構對硬體的適配.md` 的 §一～§四 已交付部分退場，
      而 §五（觸發條件）與 §六（假硬體元件）**留著**——它們還沒做

## 依賴

```
T001 → T002 → T003 → T004 → T005          （US3 獨立）
T001 → T006 → T007 → T008 → T009 → T010   （凍結明表，順序不可換）
              T010 → T011 → T012
                     T012 → T013 → T014 → T015 → T016
T016 → T017…T022
```

**平行機會**：US3（T002–T005）與 US1（T006–T016）**理論上可平行**，
而實務上不建議——它們都會改 import，同時做會讓 `tsc` 的錯誤訊息混在一起。

## MVP

**T002–T005（US3）就是一個完整的增量**：`src/views/` 消失、測試仍綠。
它可以單獨交付而不做 US1。

## 基準（T001 填）

```
vitest  : ____ passed
e2e     : ____ passed
```
