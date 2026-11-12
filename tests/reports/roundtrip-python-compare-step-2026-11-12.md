# Round-Trip 測試報告 — Python — 比較鏈三段以上（python:compare_step）— 2026-11-12

| # | 程式 | 概念 | 結果 | 細節 |
|---|------|------|------|------|
| 1 | `y = 0 < x < 20 != 21` | compare_chain ＋ compare_step | ✅ PASS | 程式碼來回、積木來回一字不差 |
| 2 | `y = a <= b <= c <= d >= e` | 兩顆 compare_step | ✅ PASS | |
| 3 | `y = 0 < x < 20` | 只有 compare_chain（對照組） | ✅ PASS | `more` 空、積木尾巴 0 格 |
| 4 | `if 0 < x < 20 != 21:` | if 條件裡的鏈 | ✅ PASS | |
| 5 | `while 0 <= i < n <= m:` | while 條件裡的鏈 | ✅ PASS | |
| 6 | `y = 0 < x < 20 != (a < b < c < d)` | 鏈的值是另一條鏈 | ✅ PASS | 括號留著（`prec + 1`） |
| 7 | `y = (0 < x < 20 != 21) and ok` | 多餘的括號 | 🔵 STRUCTURE_DIFF | 走積木回來 `y = 0 < x < 20 != 21 and ok`——**既有的一般正規化**（`(a < b) and ok` 一樣），語義相同 |
| 8 | `y = 1 < x in z`、`a < b not in c < d`、`a is b < c` | 混 `in`／`is` | 🟡 DEGRADED | 🔴 **修了一個既有缺陷**：之前落到一般比較、**安靜地**砍成 `1 < x`；現在整條主動變灰、原文產回 |

執行（Cella）：`1 < 2 < x < 22 != x + 1 != 21` 四個 x 的輸出、每一格只求值一次與短路（`f(5) < f(1) != f(21)` 不算 `f(21)`）——spec.test.ts。

摘要：6 PASS、1 STRUCTURE_DIFF（既有正規化）、1 DEGRADED（照實降級，原本是安靜的截斷）。

永久測試：`src/components/python/compare_chain/spec.test.ts`、`src/components/python/compare_step/spec.test.ts`、`tests/integration/python-loop-names-through-blocks.test.ts`（+8）。
