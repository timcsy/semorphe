# Implementation Plan: 參照編譯器族退場（重構 6c-5）

**Branch**: `256-retire-refcc` | **Date**: 2026-11-04 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/212-retire-refcc/spec.md`

## Summary

`npm test` 裡 21 支測試即時呼叫參照編譯器。三種處置（[research.md](research.md)）：
① 「來回一趟的程式碼行為不變」那一族（g++ 跑原始碼 vs g++ 跑產回的碼）改成 **Cella 跑兩份、比輸出**；
② 「Cella 對 g++」的交叉檢查：參照那一半換成**寫死的期望字串**——由一次性的擷取把 g++ 當下的輸出抄進測試（與 Cella 一致才寫；不一致的逐條判），之後不再需要編譯器；
③ 護欄族依它守的東西處置：課文答案的比對改由 Cella 斷言（接手 `audit-lesson-answers-vs-compiler`），其餘三支隨輔助檔退場。
另留一支探針（`tests/probes/`，環境變數開）做「Cella 對 g++」的交叉檢查，量的是我們的翻譯。

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Vitest、cella-lang／@cella-lang/*（判準）、web-tree-sitter
**Storage**: N/A
**Testing**: Vitest（`npm test`、`npm run test:guard`）、Playwright（e2e）
**Target Platform**: 開發機（macOS）與 CI（ubuntu）
**Project Type**: 單一前端專案的測試基礎設施
**Performance Goals**: 全套時間不得變慢（對照 6c-4 之後的 14.8 分）
**Constraints**: 斷言條數不得減少（SC-004）；本機不設墊片環境變數也全綠（SC-002）
**Scale/Scope**: 21 支測試檔 ＋ 1 支探針 ＋ 1 支輔助檔 ＋ CLAUDE.md 三段 ＋ 長測試腳本

## Constitution Check

| 原則 | 判定 |
|---|---|
| I 簡約優先 | ✅ 這一刀是**減**：拿掉一個判準來源、三支護欄；新增的只有一條護欄條目（併入 `audit-cella-only`）與一支探針（spec FR-006，唯一能量到「我們翻錯」的量尺，有當前需求） |
| II 測試驅動 | ✅ 先加「npm test 不得呼叫參照編譯器」的硬性零（先紅：21 支），再逐支改到綠；課文比對的斷言先寫、故意改錯一個字確認會紅 |
| III Git 紀律 | ✅ 依處置族分批提交 |
| IV 規格文件保護 | ✅ |
| V 繁體中文 | ✅ |

Post-design 重查：無違規。

## Project Structure

### Documentation (this feature)

```text
specs/212-retire-refcc/
├── plan.md
├── research.md
├── quickstart.md
└── tasks.md            # /speckit-tasks 產生
```

（無 data-model.md、contracts/：這一刀不新增資料與介面。）

### Source Code (repository root)

```text
tests/
├── helpers/run-cpp.ts                    # 保留，只給探針用（護欄擋 npm test 範圍 import 它）
├── integration/                          # 21 支改判準；3 支護欄退場
├── probes/refcc-cross-check.test.ts      # 新：Cella 對 g++（環境變數開）
└── integration/audit-cella-only.test.ts  # 加一條硬性零
tools/long-test.sh                        # 拿掉墊片的必要性
CLAUDE.md                                 # 🪦 三段改寫
```

**Structure Decision**: 沿用既有目錄；參照編譯器的輔助檔不刪，降級成探針專用（護欄守著範圍）。

## Complexity Tracking

無。
