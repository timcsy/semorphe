# Implementation Plan: 把剩下的語言專屬執行器搬完

**Branch**: `055-finish-executor-move` | **Date**: 2026-08-06 | **Spec**: [spec.md](./spec.md)

## Summary

56 個語言專屬執行器搬出核心（8 個混住檔 38 個 ＋ 執行引擎內嵌 18 個），25 個通用執行器留下。

Phase 0 的兩個發現：

1. **「混住」不是判斷題，是查表題**——概念定義裡就有層級欄位，拆分可機械導出。
2. **護欄有一個反方向的盲點**——4 個概念有實作卻沒宣告，而報表照著定義走，所以它們完全隱形。三個要補宣告，一個查不清楚（不搬也不刪，只登記）。

## Technical Context

**Language/Version**: TypeScript 5.9 ｜ **Dependencies**: 無新增 ｜ **Testing**: Vitest

**Constraints**: 執行行為零改動；語言耦合 MUST 下降；其餘量測 MUST NOT 上升

**Scale/Scope**: 56 個搬移、3 個補宣告、1 個待決；跨 9 個來源檔

## Constitution Check

| 條 | 評估 |
|---|---|
| **I. 簡約優先** | ✅ 不新增相依。新增的量測（有實作無宣告）**不是預留**——它現在就抓到 4 個 |
| **II. TDD 非妥協** | ✅ 清冊與落點檢查先於搬移 |
| **III. Git 紀律** | ✅ 每組一 commit；基線獨立 |
| **IV. 規格文件保護** | ✅ |
| **V. 繁體中文優先** | ✅ |

**Post-Design 複查**：唯一的新機制是「落點與宣告一致」的檢查與「有實作無宣告」的量測，兩者都直接對應 Phase 0 實測到的風險。✅

## Project Structure

```text
src/languages/cpp/
├── core/executors/{variables,control-flow,functions,operators,arrays,mutations,literals}.ts  # 新
├── std/{cstdio,cstdlib,algorithm,numeric,utility}/executors.ts                              # 新／擴充
├── core/concepts.json                    # 改：補 cpp_comma_expr、var_declarator
└── ...
src/blocks/semantics/universal-concepts.json  # 改：補 program

src/interpreter/executors/*.ts            # 改：只留通用執行器
src/interpreter/interpreter.ts            # 改：內嵌執行器移出

tests/integration/
├── executor-inventory.test.ts            # 擴充：加「落點與宣告一致」
└── audit-orphan-implementations.test.ts  # 新：有實作無宣告（第八條護欄）
```

## Phase 0／1 摘要

見 [research.md](./research.md)。

- **落點由層級欄位決定**，不由檔名
- **清冊比對抓漏失、抓不到錯置**——因此另加落點檢查
- **`compound_assign` 不搬不刪只登記**——三種角色三種含義，查不清楚時方向是保留

## Complexity Tracking

| 增加的複雜度 | 為什麼必要 | 若省略會怎樣 |
|---|---|---|
| 落點與宣告一致的檢查 | 清冊比對抓不到錯置 | 搬錯模組全綠 |
| 「有實作無宣告」量測 | 現在就抓到 4 個 | 這個方向永遠沒人看 |
