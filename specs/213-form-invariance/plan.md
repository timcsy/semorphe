# Implementation Plan: 換形態，判決不變（第一層）

**Branch**: `262-form-invariance` | **Date**: 2026-11-04 | **Spec**: [spec.md](spec.md)

## Summary

一支常駐的整合測試 `tests/integration/form-invariance.test.ts`：課文判決綁定語料（`tests/helpers/binding-corpus`）的每一支，
算出「原樣」的正規化程式，再算三種轉換後的正規化程式，逐支比；不同的列出（支、轉換、第一個不同的路徑），釘子附歸因。
I/O 風格切換另一支斷言比判決與輸出。學生語料走 `tests/probes/form-invariance-studycpp.test.ts`（`STUDYCPP_DIR`）。

## Technical Context

**Language/Version**: TypeScript 5.x · **Testing**: Vitest · **Dependencies**: web-tree-sitter、Blockly（headless，沿用 `declaration-shapes-roundtrip` 的架子）、`formalize`（`src/providers/cella/formalize`）
**Scope**: 1 支整合測試、1 支探針、一個正規化工具（測試輔助）、量到的缺陷修在對應的元件或投影

## Constitution Check

| 原則 | 判定 |
|---|---|
| I 簡約 | ✅ 沿用既有的語料與積木架子；正規化只是「依出現順序重新編號 `n` 欄位」 |
| II TDD | ✅ 先寫注入（一個會換意思的轉換必紅），再接語料 |
| III Git | ✅ 量測、每一族缺陷的修法分開提交 |
| V 繁中 | ✅ |

## Design

- **正規化**：走程式 JSON，把每一個 `n`（節點標籤 `<id>`／`<id>/<角色>`／`<id>#<槽>`）的 `<id>` 依第一次出現的順序換成 `#1`、`#2`…，後綴保留。
- **(a) 同風格來回**：`formalize(lift(generate(tree, style)))`，style 用課文宣告的那一個（沒有就 apcs）。
- **(b) 格式風格切換**：同一棵樹換 `google`（縮排 2、explicit）與 `apcs`（縮排 4、using）、`competitive` 的 header 換成 bits——只挑 io_style 相同的配對。
- **(c) 積木來回**：`renderToBlocklyState(tree)` → `Blockly.serialization.workspaces.load` → 抽回（沿用 `declaration-shapes-roundtrip` 的 extract 路徑）→ `formalize`。
- **判決層**（I/O 風格切換）：`cout` 的課文換成 `printf` 風格產碼再讀回，Cella 判決與輸出相同。

## Risks

- 骨架（main、#include）在積木那一路可能被隱藏／重建——比較前兩邊都經同一個骨架組裝（`withScaffold`）。
- 量到的不一致可能很多：先分族（同一個欄位差異的歸一族），一族一修。
