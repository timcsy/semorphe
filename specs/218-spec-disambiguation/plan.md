# Implementation Plan: 規格消歧試驗（第一版 C 與 Arduino）

**Branch**: `352-spec-disambiguation` | **Date**: 2026-11-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/218-spec-disambiguation/spec.md`

## Summary

課文任務可以宣告多個解讀、各附參考解答；情境 `{kind, payload}` 由領域套件註冊（C：標準輸入，從語意樹的讀取順序產生；Arduino：時間序列輸入）；
比對器是純模組（不碰 DOM、不碰檔案系統），判決由呼叫端注入，瀏覽器（產品）與 Node（cos-mos 批次、我們的測試）都能跑；課文頁多一塊並排比對與點選。

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: 既有的 Cella 提供者（`src/providers/cella/`）、web-tree-sitter（lift）、Vite（`import.meta.glob` 載入課文）
**Storage**: 老師的選擇存 localStorage（同課文進度；介面留給 cos-mos 接正式紀錄）
**Testing**: Vitest（`expectCellaOut`／`runCella` 那套）、Playwright e2e（並排畫面）
**Target Platform**: 瀏覽器（產品）＋ Node（批次與測試）——比對器兩邊共用
**Project Type**: 既有的單一前端專案（`src/`、`tests/`、`e2e/`）
**Performance Goals**: 一份示範題預設情境數下完整比對 < 10 秒（SC-005）
**Constraints**: 純前端、不找後端；核心不認得任何情境種類（FR-003）；比對器不碰 DOM／檔案系統（FR-007）
**Scale/Scope**: 第一版兩份示範題（C 一份、Arduino 一份）；情境數上限每種 20

## Constitution Check

| 原則 | 這一刀 | 判定 |
|---|---|---|
| I. 簡約優先 | 只做兩種情境；第三種等真的來了再驗證抽象；比對器只回第一個不一致 | ✅ |
| II. 測試驅動 | 每個 US 先寫紅的測試（示範題三支程式的預期比對結果），再實作 | ✅ |
| III. Git 紀律 | worktree `semorphe-352`、分支 `352-spec-disambiguation`；長測試後合併 | ✅ |
| IV. 規格文件保護 | 只動 `specs/218-*` | ✅ |
| V. 繁體中文優先 | 文件、註解、畫面文字 | ✅ |

專案原則（`knowledge/principles.md`）對照：P6 誠實降級——判決不是成功執行的情境照實標「不可比」（FR-008）；P9 宿主獨立——比對器兩個宿主同一份。

## Project Structure

### Documentation (this feature)

```text
specs/218-spec-disambiguation/
├── plan.md  research.md  data-model.md  quickstart.md
└── contracts/
    ├── scenario-registry.md
    └── comparator.md
```

### Source Code (repository root)

```text
src/core/disambiguation/          核心：不認得任何情境種類、不碰 DOM／檔案系統
├── types.ts                      Scenario、Interpretation、ComparisonResult、Judge
├── scenario-registry.ts          registerScenarioKind／scenarioGeneratorFor
└── compare.ts                    compareInterpretations(student, refs, scenarios, judge)

src/languages/cpp/scenarios/      C 家族的兩種情境（領域套件註冊）
├── stdin.ts                      從 tests/helpers/stdin-from-tree.ts 搬進來（測試輔助改成 re-export）
└── board-inputs.ts               Arduino：讀了哪些輸入腳 → 時間序列

src/core/lesson/load-lessons.ts   interpretations 欄位；solutionFor 只比對 <task>.<ext>；interpretationSolutionFor
src/providers/cella/judge.ts      產品的 Judge：把一個情境變成判決請求（stdin／板子輸入）
src/ui/lesson-disambiguation.ts   課文頁的並排與點選（＋選擇存 localStorage）

lessons/c-bridge/…  lessons/arduino/…   各一題宣告兩個解讀＋解答
tests/integration/disambiguation-*.test.ts   示範題、兩個宿主同結果、退化成單解讀
tests/integration/audit-disambiguation.test.ts  護欄：解讀都有解答、核心不出現種類名、比對器不 import DOM／fs
e2e/disambiguation.spec.ts        並排畫面與點選
```

**Structure Decision**: 比對器與情境登記處住核心（語言中立、宿主中立）；兩種情境住 C 家族語言套件；判決的接法住提供者；畫面住 `src/ui/`。

## Complexity Tracking

無違反。
