# Round-Trip 測試結果（Python — 裝飾器，第 424 刀）— 2026-11-12

| # | 程式 | 概念 | 結果 | 細節 |
|---|------|------|------|------|
| 1 | class_three_kinds | class_def、decorated（staticmethod／classmethod／property） | ✅ PASS | Cella 輸出＝python3 |
| 2 | property_setter | decorated（`@w.setter` 屬性運算式） | ✅ PASS | |
| 3 | stacked_custom | 兩層裝飾器、呼叫形式 `@plus(3)`，由下往上套用 | ✅ PASS | |
| 4 | nested_decorated | 巢狀函式裡的裝飾器 | ✅ PASS | |
| 5 | decorator_in_loop_use | 自己寫的登錄裝飾器 | ✅ PASS | |
| 6–9 | 走真積木（無頭 Blockly） | 名字／屬性／呼叫、類別上的裝飾器、類別裡的方法 | ✅ PASS | `python-loop-names-through-blocks` |

摘要：9/9 PASS。信心分布：零 raw_code／unresolved。

## 觀察
- 原文的空行不在語義樹裡，產碼不寫空行——既有的正規化（與裝飾器無關），比對時去掉原文空行。
- 降級：`@(lambda f: f)`、`@xs[0]` 整段照實保留（`spec.test.ts`）。
- `functools.lru_cache`：Cella 不支援 → `knownCellaGap`。

測試檔：`tests/integration/roundtrip-python-decorated.test.ts`、`tests/integration/python-loop-names-through-blocks.test.ts`（+4）。
