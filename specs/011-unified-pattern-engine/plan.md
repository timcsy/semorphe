# Implementation Plan: 統一 Pattern Engine 三層表達能力架構

**Branch**: `011-unified-pattern-engine` | **Date**: 2026-03-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-unified-pattern-engine/spec.md`

## Summary

重構 Pattern Engine 為單一管線架構，消除 Lifter 和 Renderer 中的雙管線競爭（`preferHandWritten` / `SWITCH_CASE_CONCEPTS` 黑名單）。引入三層表達能力：Layer 1 純 JSON、Layer 2 JSON + Transform、Layer 3 JSON + Strategy。所有現有 hand-written lifter 和 switch-case renderer 遷移為語言模組的註冊函數，核心引擎不再包含語言特定邏輯。

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Blockly 12.4.1, web-tree-sitter 0.26.6, Vite
**Storage**: N/A（Registry 為記憶體中的 Map）
**Testing**: Vitest（現有 745+ 測試）
**Target Platform**: Web browser
**Project Type**: Web application（教育用積木編程工具）
**Performance Goals**: N/A（spec 明確排除，當前規模不需要）
**Constraints**: 遷移後全部既有測試 100% 通過，瀏覽器行為不變
**Scale/Scope**: 單一使用者本地應用，約 30 個概念需遷移

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. 簡約優先 | PASS | 此重構是**移除**複雜度（消除雙管線 + 黑名單），非新增。三個 Registry 各自職責單一，是最小必要的抽象 |
| II. TDD | PASS | 遵循 TDD：先寫 Registry 測試，再實作；先寫遷移後的整合測試，再遷移 |
| III. Git 紀律 | PASS | 每完成一個 task 或一組相關 task 後 commit |
| IV. 規格文件保護 | PASS | 不觸碰 specs/ 和 .specify/ 下的既有文件 |
| V. 繁體中文優先 | PASS | 規格文件為繁體中文，程式碼維持英文 |

無 violation，無需 Complexity Tracking。

## Project Structure

### Documentation (this feature)

```text
specs/011-unified-pattern-engine/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── transform-registry.md
│   ├── lift-strategy-registry.md
│   ├── render-strategy-registry.md
│   └── enhanced-field-mapping.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── lift/
│   │   ├── lifter.ts              # 簡化：移除 preferHandWritten，單一管線
│   │   └── pattern-lifter.ts      # 增強：transform, strategy, $namedChildren[N]
│   ├── projection/
│   │   ├── block-renderer.ts      # 簡化：移除 SWITCH_CASE_CONCEPTS 和 switch-case
│   │   └── pattern-renderer.ts    # 增強：renderStrategy
│   ├── registry/
│   │   ├── transform-registry.ts  # 新增：Layer 2
│   │   ├── lift-strategy-registry.ts   # 新增：Layer 3
│   │   └── render-strategy-registry.ts # 新增：Layer 3
│   └── types.ts                   # 擴展：FieldMapping 新增 transform 欄位
├── languages/
│   └── cpp/
│       ├── lifters/               # 重構：hand-written → strategy 函數
│       │   ├── index.ts           # 改為向 Registry 註冊
│       │   ├── strategies.ts      # 新增：Layer 3 lift strategy 函數
│       │   └── transforms.ts      # 新增：Layer 2 transform 函數
│       ├── renderers/
│       │   └── strategies.ts      # 新增：Layer 3 render strategy 函數
│       └── lift-patterns.json     # 更新：加入 transform/liftStrategy 欄位
└── ui/
    └── app.new.ts                 # 更新：Registry 初始化

tests/
├── unit/
│   └── core/
│       ├── transform-registry.test.ts      # 新增
│       ├── lift-strategy-registry.test.ts   # 新增
│       ├── render-strategy-registry.test.ts # 新增
│       └── pattern-lifter.test.ts           # 擴展：transform/strategy/namedChildren 測試
├── integration/
│   └── unified-pipeline.test.ts             # 新增：驗證單一管線端到端
└── (existing 745+ tests unchanged)
```

**Structure Decision**: 在 `src/core/registry/` 新增三個 Registry 檔案。C++ 語言模組在 `lifters/` 和新增的 `renderers/` 下組織 transform 和 strategy 函數。遵循現有目錄結構，最小化新增路徑。
