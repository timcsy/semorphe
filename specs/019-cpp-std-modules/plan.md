# Implementation Plan: C++ Std Modules Reorganization

**Branch**: `019-cpp-std-modules` | **Date**: 2026-03-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/019-cpp-std-modules/spec.md`

## Summary

將目前散落在 `basic.json`、`special.json`、`stdlib-containers.json`、`stdlib-algorithms.json` 等檔案中的 C++ 標準函式庫相關積木、概念、lifters、generators，按 header 重新組織到 `languages/cpp/std/` 目錄下。每個 header 一個子目錄，包含四個標準檔案。`languages/cpp/core/` 保留不需 `#include` 的語言核心。新增 auto-include 機制與模組化借音偵測。

## Technical Context

**Language/Version**: TypeScript 5.x + Blockly 12.4.1, web-tree-sitter 0.26.6, Vite
**Primary Dependencies**: Blockly, web-tree-sitter, Monaco Editor (VSCode)
**Storage**: N/A（記憶體中的 Registry）
**Testing**: Vitest（現有 1507+ 測試）
**Target Platform**: 瀏覽器 + VSCode Extension WebView
**Project Type**: library（教育工具的核心引擎）
**Performance Goals**: 積木操作即時回應（<100ms）
**Constraints**: 重構不得破壞現有功能；瀏覽器版和 VSCode 版都必須正常運作
**Scale/Scope**: ~61 個 C++ 概念、~57 個 C++ 積木，分散在 4+ 個 JSON 和 4+ 個 TS 檔案中

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 狀態 | 說明 |
|------|------|------|
| I. 簡約優先 | ✅ PASS | 不引入新的外部依賴；std module 結構是目前需求的最小化組織方式 |
| II. TDD | ✅ PASS | 現有測試全部保留，新增模組載入測試；每步重構後跑測試 |
| III. Git 紀律 | ✅ PASS | 按 header 逐步遷移，每個 header 完成後 commit |
| IV. 規格文件保護 | ✅ PASS | 不影響 specs/ 和 .specify/ |
| V. 繁體中文優先 | ✅ PASS | 文件以繁體中文撰寫 |

## Project Structure

### Documentation (this feature)

```text
specs/019-cpp-std-modules/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/languages/cpp/
├── core/                          # 語言核心（不需 #include）
│   ├── concepts.json              # if, for, while, var_declare, func_def, etc.
│   ├── blocks.json                # c_for_loop, c_switch, c_case, c_ternary, etc.
│   ├── generators/
│   │   ├── statements.ts          # if, while, for, do-while, switch, break, continue, func_def
│   │   ├── declarations.ts        # var_declare, var_assign, array_declare, array_access
│   │   ├── expressions.ts         # arithmetic, compare, logic, unary, casts, precedence
│   │   └── index.ts               # 聚合所有 core generators
│   └── lifters/
│       ├── statements.ts          # if_statement, while, for → count_loop/cpp_for_loop
│       ├── declarations.ts        # expression_statement, assignment_expression
│       ├── expressions.ts         # binary_expression, unary, identifiers, literals
│       ├── strategies.ts          # 註冊式 lift strategies
│       ├── transforms.ts          # comment stripping
│       └── index.ts               # 聚合所有 core lifters
├── std/                           # 標準函式庫模組
│   ├── index.ts                   # 聚合器：匯出所有 std 模組
│   ├── types.ts                   # StdModule 介面定義
│   ├── iostream/
│   │   ├── concepts.json          # iostream 相關概念（或空，若全用 universal）
│   │   ├── blocks.json            # iostream 相關積木投影
│   │   ├── generators.ts          # cout, cin, endl 生成
│   │   └── lifters.ts             # cout/cin chain 偵測
│   ├── cstdio/
│   │   ├── concepts.json          # cpp_printf, cpp_scanf
│   │   ├── blocks.json            # c_printf, c_scanf 投影
│   │   ├── generators.ts          # printf/scanf 生成
│   │   └── lifters.ts             # printf/scanf extraction
│   ├── vector/
│   │   ├── concepts.json
│   │   ├── blocks.json
│   │   ├── generators.ts
│   │   └── lifters.ts
│   ├── algorithm/
│   │   ├── concepts.json
│   │   ├── blocks.json
│   │   ├── generators.ts
│   │   └── lifters.ts
│   ├── string/
│   │   ├── concepts.json
│   │   ├── blocks.json
│   │   ├── generators.ts
│   │   └── lifters.ts
│   └── cmath/
│       ├── concepts.json
│       ├── blocks.json
│       ├── generators.ts
│       └── lifters.ts
├── renderers/                     # 保持不變（跨模組 render strategies）
│   └── strategies.ts
├── styles/                        # 保持不變
│   ├── apcs.json
│   ├── competitive.json
│   └── google.json
├── style-exceptions.ts            # 更新：改用模組化借音偵測
├── parser.ts                      # 保持不變
├── types.ts                       # 保持不變
├── module.ts                      # 更新：使用 core/ + std/ 載入
└── auto-include.ts                # 新增：auto-include 引擎

src/blocks/                        # 保持不變（universal 層）
├── semantics/universal-concepts.json
└── projections/blocks/universal-blocks.json

vscode-ext/src/webview/main.ts     # 更新 import 路徑
src/ui/app.ts                      # 更新 import 路徑
```

**Structure Decision**: 採用 `core/` + `std/{header}/` 雙層結構。core 保留子目錄 `generators/` 和 `lifters/` 因為核心概念數量多（~40 個），需要按功能分檔。std 模組每個 header 概念少（2-10 個），各用單一 generators.ts 和 lifters.ts 即可。

## 遷移策略

採用**漸進式遷移**（incremental migration）：

1. **Phase A — 建立骨架**：建立 `core/` 和 `std/` 目錄結構、StdModule 介面、聚合器
2. **Phase B — 遷移 core**：將不依賴 #include 的概念/積木/generators/lifters 搬到 `core/`
3. **Phase C — 遷移 std 模組**：逐個 header 搬遷（iostream → cstdio → vector → algorithm → string → cmath）
4. **Phase D — 清理**：刪除舊檔案（basic.json, special.json, stdlib-*.json），更新所有 import
5. **Phase E — Auto-include**：實作 auto-include 引擎
6. **Phase F — 模組化借音**：更新 style-exceptions.ts 使用模組歸屬偵測

每個 phase 結束時 `npm test` 必須全部通過。

## 關鍵設計決策

### 1. StdModule 介面

每個 std 模組匯出一個符合 `StdModule` 介面的物件：

```typescript
interface StdModule {
  header: string                    // e.g., '<iostream>'
  concepts: ConceptDefJSON[]
  blocks: BlockProjectionJSON[]
  registerGenerators: (g: Map<string, NodeGenerator>, style: StylePreset) => void
  registerLifters: (lifter: Lifter, ctx: LiftContext) => void
}
```

### 2. Core Module 結構

Core 不實作 StdModule 介面（它不對應任何 header），而是直接匯出 register 函式：

```typescript
// core/index.ts
export { coreConcepts, coreBlocks }
export { registerCoreGenerators } from './generators'
export { registerCoreLifters } from './lifters'
```

### 3. Auto-include 引擎

在 code generation 階段，掃描 semantic tree 中所有概念，透過 Module Registry 反查所屬 header，收集去重後產出 `#include` 行。與手動 `c_include` 積木合併去重。

### 4. 模組化借音偵測

現有 `style-exceptions.ts` 改為：根據 style preset 的 `io_style` 決定「偏好模組」（iostream 或 cstdio），偵測到使用非偏好模組的概念時觸發借音。

### 5. 概念歸屬分類

| 目標模組 | 概念 |
|----------|------|
| **core** | if, while_loop, count_loop, for_loop, cpp_for_loop, cpp_do_while, cpp_switch, cpp_case, cpp_default, break, continue, var_declare, var_assign, var_ref, number_literal, string_literal, cpp_char_literal, arithmetic, compare, logic, cpp_increment, cpp_compound_assign, cpp_bitwise_not, cpp_ternary, cpp_cast, func_def, forward_decl, func_call_expr, array_declare, array_access, array_assign, cpp_pointer_assign, cpp_pointer_deref, cpp_address_of, cpp_include, cpp_include_local, using_declaration |
| **std/iostream** | print, input（universal 概念但 generator 在此）、endl |
| **std/cstdio** | cpp_printf, cpp_scanf |
| **std/vector** | vector_create, vector_push_back, vector_size, vector_at, vector_pop_back, vector_empty, vector_clear |
| **std/algorithm** | algorithm_sort, algorithm_find, algorithm_reverse, algorithm_count, algorithm_min_element, algorithm_max_element, algorithm_transform |
| **std/string** | string_length, string_substr, string_find, string_append, string_compare |
| **std/cmath** | math_abs, math_sqrt, math_pow, math_ceil, math_floor, math_round |

### 6. 入口點更新

瀏覽器 `app.ts` 和 VSCode `main.ts` 改為：

```typescript
import { coreConcepts, coreBlocks, registerCoreGenerators, registerCoreLifters } from '../languages/cpp/core'
import { allStdModules } from '../languages/cpp/std'

// 載入所有概念和積木
const allConcepts = [...universalConcepts, ...coreConcepts, ...allStdModules.flatMap(m => m.concepts)]
const allBlocks = [...universalBlocks, ...coreBlocks, ...allStdModules.flatMap(m => m.blocks)]

// 註冊 generators 和 lifters
registerCoreGenerators(g, style)
registerCoreLifters(lifter, ctx)
for (const mod of allStdModules) {
  mod.registerGenerators(g, style)
  mod.registerLifters(lifter, ctx)
}
```

## Complexity Tracking

無違反 — 不需額外追蹤。
