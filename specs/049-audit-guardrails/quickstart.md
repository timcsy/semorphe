# Quickstart：驗證四條護欄

**Feature**: 049-audit-guardrails ｜ **Date**: 2026-08-06

驗證的核心不是「測試綠」——本功能的護欄**第一天就是紅字滿滿的報表**。要驗的是：**數字量得出來、報表看得懂、惡化擋得住、改善反映得出來。**

## 前置

```bash
npm install          # 已有環境可略
npm test             # 基準：既有測試必須全綠（3006 測 / ~20 秒）
```

## 情境 1：四條護欄各自量得出非零基線（SC-001）

```bash
npx vitest run tests/integration/audit-neutrality.test.ts
npx vitest run tests/integration/audit-completeness.test.ts
npx vitest run tests/integration/audit-defect-ledger.test.ts
npx vitest run tests/integration/audit-locality.test.ts
```

**預期**：每條都印出人類可讀報表，且**數字為正**。零就是沒量到東西 —— 見 `research.md` D2。

## 情境 2：棘輪擋得住惡化（SC-002）

**中立性**：在 `src/core/` 任一檔加一行 `const x = 'cpp_string_at'`

```bash
npx vitest run tests/integration/audit-neutrality.test.ts
```

**預期**：失敗，且訊息**指名是哪個檔、哪個 componentId**（不只是「總數變了」）。
還原後重跑 → 通過。

**缺陷帳**：新增一個沒有標記的 `it.todo('random')`

**預期**：失敗並列出未分類項目（FR-033）。

## 情境 3：改善反映得出來（US1 場景 3）

清掉 `neutrality.json` 中任一檔的一個違規（或直接從基線移除一筆）

**預期**：量測結果 ⊊ 基線 → **通過**，且報表提示可下調基線。
再把基線下調並 commit → 該項此後不得再出現。

## 情境 4：完備性分得出「殼」與「刻意的空」（US2 場景 2、3）

1. 找一個 executor 為空操作、且 `concepts.json` 未宣告 `skipPaths` 的元件 → 報表應標為 **🈳 殼**
2. 為該元件加上 `"skipPaths": ["execute"]` → 重跑 → 應改判為 **✅ 實作**
3. **還原**（本功能只量不修，不留下這個修改）

**預期**：兩次結果不同，證明「顯式宣告」真的被讀取。

## 情境 5：兩組態差異照得出來（FR-023）

```bash
npx vitest run tests/integration/audit-completeness.test.ts
```

**預期**：報表含「組態差異」區塊，列出在**宣告組態**（接上 TemplateGenerator）與**現行組態**下分類不同的元件。

根據 `research.md` F2／F3，此區塊**不應為空**——全專案有 93 個概念宣告了 `codeTemplate`，而 app 從未接上 TemplateGenerator。空的差異區塊代表護欄本身沒接對。

## 情境 6：補完地圖可讀（SC-003, SC-008）

```bash
cat tests/reports/completeness-map.md
```

**預期**：涵蓋註冊表**全部**元件的 元件 × 五路徑 矩陣，無元件被略過。
驗收標準是 SC-008：**不看任何實作程式碼，只看這張表，能判斷某個元件到底做完了沒。**

## 情境 7：優先序可見（SC-005）

在缺陷帳報表中找「按阻斷者彙總」區塊。

**預期**：能直接回答「修哪一個元件可以解鎖最多測試」。
目前完全無法回答——這是本功能對維護排序最直接的貢獻。

## 情境 8：零行為改動、不拖垮迴圈（SC-006, SC-007）

```bash
time npm test
```

**預期**：
- 既有 3006 測維持全綠
- 總耗時增加 **≤ 10 秒**（現況約 20 秒）
- 除新增的護欄輸出外，**沒有任何既有輸出改變**

## 常見誤判

| 現象 | 不是 bug |
|---|---|
| 護欄第一次跑就「失敗」 | 基線檔尚未建立。先跑一次產出基線、commit，之後才是棘輪 |
| 中立性報表有註解引用 | 註解**不計入基線**（`research.md` D1）；為降數字去刪有用註解是反效果 |
| 完備性報表綠了但仍有 bug | 完備性護欄**明確不檢測「條件性正確」**（FR-025）。單獨測通過、組合時失敗的問題由既有 fuzz 測試負責 |

## 相關

- `spec.md` — 需求與驗收標準
- `research.md` — 六項技術決策與三個既有事實（F1–F3）
- `data-model.md` — 四種結果的資料形
- `contracts/README.md` — 基線檔格式與標記語法
