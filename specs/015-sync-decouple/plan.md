# Implementation Plan: Phase 1 — SyncController 解耦

**Branch**: `015-sync-decouple` | **Date**: 2026-03-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/015-sync-decouple/spec.md`

## Summary

將 SyncController 從直接持有面板引用改為透過 SemanticBus 事件通訊。四個面板實作 ViewHost 介面並自行訂閱 bus 事件。App 層負責建立 bus 並接線。

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: 無新增（使用 Phase 0 建立的 SemanticBus + ViewHost）
**Storage**: N/A
**Testing**: Vitest
**Target Platform**: 瀏覽器（DOM 依賴僅在面板層）
**Project Type**: 應用架構重構
**Constraints**: 零功能退化、現有測試全通過

## Constitution Check

| 原則 | 狀態 | 說明 |
|------|------|------|
| I. 簡約優先 | ✅ | 只重構通訊路徑，不新增功能 |
| II. TDD | ✅ | SyncController + bus 的整合測試先寫 |
| III. Git 紀律 | ✅ | 每個 US 完成後 commit |
| IV. 規格保護 | ✅ | 不動 specs/ |
| V. 繁體中文 | ✅ | 文件繁中、碼英文 |

## Project Structure

### Documentation

```text
specs/015-sync-decouple/
├── spec.md, plan.md, research.md, data-model.md
├── contracts/sync-bus-protocol.md
├── quickstart.md
└── tasks.md
```

### Source Code Changes

```text
src/core/
├── semantic-bus.ts           # MODIFY — 擴充 SemanticEvents payload

src/ui/
├── sync-controller.ts        # REWRITE — 移除面板 import，改用 bus
├── panels/
│   ├── blockly-panel.ts      # MODIFY — implements ViewHost, 訂閱 bus
│   ├── monaco-panel.ts       # MODIFY — implements ViewHost, 訂閱 bus
│   ├── console-panel.ts      # MODIFY — implements ViewHost, 訂閱 bus
│   └── variable-panel.ts     # MODIFY — implements ViewHost, 訂閱 bus
└── app.ts                    # MODIFY — 建立 bus, 注入面板和 SyncController

tests/unit/ui/
├── sync-controller.test.ts   # REWRITE — 用 mock bus 測試
└── panel-independence.test.ts # NEW — 面板獨立性驗證
```

**Structure Decision**: 不新增目錄，在現有檔案上重構。SyncController 留在 `src/ui/` 因為它仍然是 UI 層的協調器（只是不再知道具體面板）。

## Complexity Tracking

無 Constitution 違規。
