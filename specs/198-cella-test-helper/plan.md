# Implementation Plan: 測試用的共用 Cella 判決入口（重構 6c-1）

**Branch**: `222-cella-test-helper` | **Date**: 2026-11-02 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/198-cella-test-helper/spec.md`

## Summary

給測試一個共用入口：一段 C／C++ 程式碼 ＋ 輸入 → 走產品同一條 lift → formalize → Cella 判決 → 回傳判決、輸出、問題（附原始碼位置）。
「斷言輸出」的用法對 unknown／invalid／reject／翻不出一律失敗並說清楚原因；「拿完整判決」的用法給刻意驗 reject 的測試。
Cella 模組重用建置時的快取（第 210 刀），把「算鍵、讀或編、寫回」抽成工具與測試共用的一個函式，不複製一份算法。
三支難度低的 B 類測試檔改用它當示範，並量出每檔多花的秒數。

## Technical Context

**Language/Version**: TypeScript 5.x（Node 24）
**Primary Dependencies**: cella-lang ＋ @cella-lang/*（main 目前的版本）、web-tree-sitter（lift）、Vitest
**Storage**: 編好的 Cella 模組放在 `node_modules/.cache/semorphe-cella/<名字>.<鍵>.wasm`（鍵 ＝ 套件版本＋模組原始碼的 sha256）
**Testing**: Vitest（`npx vitest run <檔>`）；注入測試證明失敗語義
**Target Platform**: Node（測試行程）；不碰瀏覽器端
**Project Type**: 單一專案（測試基礎建設）
**Performance Goals**: 同一個測試檔裡第二次起的判決不付模組準備的成本；量出「一檔多花幾秒」（SC-003）
**Constraints**: 走產品同一條路徑（FR-002）；不得新增跳過條件（SC-004）；vitest 每個測試檔各自載入模組——「只準備一次」的單位是**測試檔**（跨檔靠磁碟快取，不必重編）
**Scale/Scope**: 新增一個 helper、一個共用的模組快取函式、一支 helper 的測試；改三支既有測試檔

## Constitution Check

| 原則 | 這一刀 | 判定 |
|---|---|---|
| I 簡約優先 | 只做入口與三支示範；快取函式是「工具已有的邏輯抽出共用」，不是為未來預留 | ✅ |
| II TDD | 先寫 helper 的測試（含 unknown／reject 兩條注入，紅）→ 實作 → 綠；示範檔是改判準，斷言先保留 | ✅ |
| III Git 紀律 | 入口、快取抽出、示範檔分開提交 | ✅ |
| IV 規格文件保護 | 不覆蓋 spec／plan／tasks | ✅ |
| V 繁體中文優先 | 文件繁中；程式識別字英文 | ✅ |

專案原則（`knowledge/principles.md`）：P6 誠實降級——判不出來要可見、要區分原因（FR-004、FR-005）；P8 不做向後相容——示範檔改完就不再引用 JS 直譯器（FR-008），不留雙判準。

## Project Structure

### Documentation (this feature)

```text
specs/198-cella-test-helper/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
└── tasks.md            （/speckit-tasks 產生）
```

（沒有 contracts/：測試用的內部 helper，不對外。）

### Source Code (repository root)

```text
tools/
├── cella-module-cache.ts      新增：算鍵、讀快取或編、寫回（precompile-cella 與測試共用）
└── precompile-cella.ts        改：改用 cella-module-cache

tests/helpers/cella-run.ts                       新增：runCella(code, opts) → 判決；expectCellaOut(code, out, opts)
tests/unit/helpers/cella-run.test.ts             新增：正向錨點＋unknown／reject／翻不出三條注入

tests/integration/execution-cpp-containers.test.ts   改：判準換成 Cella
tests/integration/vector-initializer-list.test.ts    改：判準換成 Cella
src/components/cpp/range_max/spec.test.ts            改：判準換成 Cella
```

**Structure Decision**: helper 放 `tests/helpers/`（與 `setup-lifter`、`run-cpp` 同一處）；模組快取的鍵屬於建置工具的知識，放 `tools/`，測試 import 它（已有前例：`tests/integration/audit-lesson-blockmaps.test.ts` import `tools/blockmap/engine-hash`）。

## Complexity Tracking

無違反。
