# Implementation Plan: Phase 0 — 解耦基礎設施

**Branch**: `014-decoupling-infra` | **Date**: 2026-03-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-decoupling-infra/spec.md`

## Summary

建立三層解耦模型的基礎設施：ViewHost 介面、SemanticBus 事件系統、Annotations 機制。純加法變更，不修改現有程式碼的行為，只新增新的型別定義和工具類別。

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: 無新增外部依賴（純 TypeScript 型別 + EventEmitter 實作）
**Storage**: N/A（記憶體中）
**Testing**: Vitest
**Target Platform**: 瀏覽器 + Node.js（零 DOM 依賴）
**Project Type**: Library（核心層基礎設施）
**Performance Goals**: N/A（介面定義 + 輕量 EventEmitter）
**Constraints**: src/core/ 零 DOM import
**Scale/Scope**: 3 個新檔案 + 1 個現有檔案擴充 + 3 個 JSON 概念 annotations 示範

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 狀態 | 說明 |
|------|------|------|
| I. 簡約優先 | ✅ PASS | 只建立 Phase 1 直接需要的介面和實作，不預做 postMessage 版 SemanticBus |
| II. TDD | ✅ PASS | SemanticBus 和 annotations 查詢有明確的測試場景；ViewHost 為純介面，用 mock 驗證 |
| III. Git 紀律 | ✅ PASS | 三個子項各自 commit |
| IV. 規格保護 | ✅ PASS | 不動現有 specs/、只新增 core/ 檔案 |
| V. 繁體中文 | ✅ PASS | 文件繁體中文，程式碼英文 |

## Project Structure

### Documentation (this feature)

```text
specs/014-decoupling-infra/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── view-host-interface.md
└── tasks.md             # Phase 2 output (by /speckit.tasks)
```

### Source Code (repository root)

```text
src/core/
├── view-host.ts          # NEW — ViewHost + ViewCapabilities 介面
├── semantic-bus.ts        # NEW — SemanticBus class + 事件型別
├── concept-registry.ts    # MODIFY — 新增 annotations 欄位 + getAnnotation()
└── types.ts               # MODIFY — ConceptDef 加 annotations 欄位

src/languages/cpp/blocks/
├── basic.json             # MODIFY — for_loop, if 加 annotations 示範
└── advanced.json          # MODIFY — func_def 加 annotations 示範

tests/unit/core/
├── view-host.test.ts      # NEW — mock 實作驗證
├── semantic-bus.test.ts   # NEW — publish/subscribe/error isolation
└── concept-registry.test.ts # MODIFY — 新增 annotations 測試
```

**Structure Decision**: 所有新增碼位於 `src/core/`，符合三層架構中 Core Layer 的定位。不新增子目錄，與現有 `concept-registry.ts`、`types.ts` 同層。
