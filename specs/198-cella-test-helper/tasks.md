# Tasks: 測試用的共用 Cella 判決入口（重構 6c-1）

**Input**: Design documents from `specs/198-cella-test-helper/`
**Prerequisites**: plan.md、spec.md、research.md、data-model.md、quickstart.md

**Tests**: 憲章 II（TDD，非妥協）——helper 的測試先寫、先紅。

## Phase 1: Setup

- [X] T001 量基準：記下三支示範檔改寫前的執行時間（`npx vitest run <檔>` 的 Duration），寫進本檔末的〈量測紀錄〉

## Phase 2: Foundational（模組快取共用）

- [X] T002 新增 `tools/cella-module-cache.ts`：`cachedCellaModule(name, source, compile, { cacheDir?, versions? })`——鍵 ＝ sha256(套件版本 ＋ 原始碼)、檔名 `<name>.<鍵>.wasm`、有就讀、沒有就 compile 並寫回；匯出 `cellaPackageVersions()`
- [X] T003 改 `tools/precompile-cella.ts` 改用 `cachedCellaModule`（行為與輸出檔名不變），跑 `npx tsx tools/precompile-cella.ts <暫存目錄>` 確認產出同樣的模組與 manifest

**Checkpoint**：建置工具照常產出；快取鍵只住一處。

## Phase 3: User Story 1 — 用一行呼叫拿到 Cella 的判決（P1）🎯 MVP

**Goal**：`runCella(code, opts)` 走 lift → formalize → verdict，回傳 data-model 的判決結果。
**Independent Test**：`cout << 1 + 2;` → accept、`3`；同一檔裡二十次呼叫，第二次起不付模組準備成本。

- [X] T004 [US1] 寫 `tests/unit/helpers/cella-run.test.ts` 的正向錨點兩條（accept 與輸出；二十次呼叫的總時間遠小於第一次準備的時間）——先紅（helper 還不存在）
- [X] T005 [US1] 實作 `tests/helpers/cella-run.ts` 的 `runCella`：懶建判決器（模組層級 Promise；讀 `cachedCellaModule('verdict-cfamily', …)` → `checkerFromBytes`）、tree-sitter 解析 → `createTestLifter().lift` → `formalize(tree, { lang })` → `checker.verdict(program, stdin, steps)`；回傳 verdict／out／problems（含 source）／untranslated／assumes
- [X] T006 [US1] 實作問題的原始碼位置：`at` → 樹裡同 id 節點 → `metadata.sourceRange`；衍生 id（`<id>/…`）退到 `<id>`；找不到只給 id
- [X] T007 [US1] 跑 T004，綠；記下第一次準備與之後每次判決的時間到〈量測紀錄〉

## Phase 4: User Story 2 — 判不出來、翻不出來、判定有錯，都會紅並說清楚（P1）

**Goal**：`expectCellaOut(code, out, opts)` 對非 accept 一律失敗並說清楚；`runCella` 給刻意驗 reject 的測試拿完整判決。
**Independent Test**：三條注入（unknown＝無窮迴圈、reject＝讀未初始化、翻不出＝內嵌組語）讓 `expectCellaOut` 拋出，訊息含判決種類、問題種類、原因、原始碼片段。

- [X] T008 [US2] 在 `tests/unit/helpers/cella-run.test.ts` 加三條注入（unknown／reject／翻不出）與一條「`runCella` 拿得到 reject 的完整判決」——先紅
- [X] T009 [US2] 實作 `expectCellaOut`：accept 且輸出相同才通過；其餘拋錯，訊息逐筆列問題（kind、reason、行號與原始碼片段）、翻不出列構造；輸出不同時印期望與實際
- [X] T010 [US2] 跑 T008，綠

**Checkpoint**：失敗語義有注入測試守著（P6）。

## Phase 5: User Story 3 — 三支既有的測試換判準之後照樣成立（P2）

**Goal**：三支示範檔不再引用 JS 直譯器，斷言照樣成立；不成立的逐條判斷。
**Independent Test**：三檔各自單獨跑綠；`grep SemanticInterpreter` 三檔無結果。

- [X] T011 [P] [US3] 改 `tests/integration/execution-cpp-containers.test.ts`：執行改用 `expectCellaOut`／`runCella`，移除直譯器 import
- [X] T012 [P] [US3] 改 `tests/integration/vector-initializer-list.test.ts`：同上
- [X] T013 [P] [US3] 改 `src/components/cpp/range_max/spec.test.ts`：執行的那幾條改用 `expectCellaOut`，其餘（lift／generate）不動
- [X] T014 [US3] 三檔單獨跑；有不成立的斷言，逐條判斷誰對（Cella 依標準／原期望值的來源），記進〈量測紀錄〉；記下改寫後的執行時間

## Phase 6: Polish

- [X] T015 `npx tsc --noEmit`；`npm run test:guard`（新增的 helper 與測試檔會動到計數基線——照實上調並寫理由）
- [ ] T016 合併 main 之後的狀態跑全套（`tools/long-test.sh … --suite`），確認沒有新增的 skip
- [ ] T017 在 `knowledge/draft/2026-11-02-6c測試盤點.md` 的風險 1、2 標上「6c-1 已處理」與量到的秒數，並註明 6c-2 用這個入口

## Dependencies

- Phase 2（快取共用）→ US1（helper 讀快取）→ US2（建在 runCella 上）→ US3（用 expectCellaOut）
- T011、T012、T013 彼此獨立（不同檔），可並行

## Implementation Strategy

MVP ＝ Phase 2 ＋ US1 ＋ US2（入口與失敗語義）；US3 證明它在真實測試上可用並量時間。每個 Phase 完成提交一次。

## 量測紀錄

- **改寫前**（T001，機器同時在跑另一條長測試）：execution-cpp-containers 7.57 秒（9 條）、vector-initializer-list 11.88 秒（6 條）、range_max 13.51 秒（4 條）
- **helper 本身**（T007）：第一次準備模組 1.3 秒（讀 `node_modules/.cache/semorphe-cella/` 的快取，沒有重編）；之後每次判決約 15 毫秒（20 次 302 毫秒）
  ⟹ 一支測試檔多約 1.3 秒；127 個 B 類以並行 2 計約多 1.4 分鐘（盤點擔心的是「每檔重編 12 秒、多 13 分鐘以上」）
- **變異檢查**（T010）：把 `expectCellaOut` 改成不檢查判決種類，三條注入（unknown／reject／翻不出）全紅——它們守得住失敗語義
- **改寫後**（T014，機器同時在跑另一條長測試，import 時間浮動大）：
  | 檔 | 改寫前（Duration／tests） | 改寫後（Duration／tests） |
  |---|---|---|
  | execution-cpp-containers（9 條） | 7.57 秒／0.007 秒 | 24.75 秒／3.05 秒 |
  | vector-initializer-list（6 條） | 11.88 秒／0.21 秒 | 15.27 秒／3.21 秒 |
  | range_max（4 條） | 13.51 秒／0.50 秒 | 14.12 秒／2.00 秒 |
  ⟹ **判決本身每檔約多 2～3 秒**（含第一次準備模組 1.3 秒）；Duration 的差主要是 import（載入）在忙碌的機器上浮動
- **斷言**：三支在 Cella 底下全部成立，沒有需要依 FR-009 逐條判斷的不一致；execution-cpp-containers 從手搭語義樹改成程式碼字串、`toContain` 收緊成完整輸出

