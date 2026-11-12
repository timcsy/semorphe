# 模糊測試報告 — Python — 2026-11-12（比較鏈三段以上，沿用盲測第二批）

## 摘要
- 沿用 11-12 盲測第二批的 10 支隔離出題（不重出題：fuzz_5 的 `print(0 < x < 20 != 21, …)` 就是這一刀的來源）
- Round-trip：10 支轉兩圈都是不動點；SEMANTIC_DIFF／COMPILE_FAIL／ROUNDTRIP_DRIFT 0
- 🟢 fuzz_5 的照實保留清單 `["raw_expression"]` → `[]`：整支收下，錨點 `python:compare_chain`、`python:compare_step`
- 執行：fuzz_5 整支卡在 Cella 不支援內建 `pow`（`knownCellaGap` 釘住）；拿掉 `pow` 那一行，其餘（含比較鏈那一行）與 python3 一字不差

## 發現的 Bug
- 無新 bug。roundtrip 階段另修了一個既有缺陷：`1 < x in z` 被一般比較安靜地砍成 `1 < x`（見 roundtrip 報告）。

## 覆蓋缺口
- `match`（fuzz_4）：Cella 的 python.cell 還沒有 match 的建構子——等 Cella。
- Cella 側：內建 `pow`（新記一筆）、`vars`、Counter／deque／heapq／bisect／string。

## 回歸測試
- `tests/integration/fuzz-python-student-2.test.ts`（fuzz_5 改成收下 ＋ 執行斷言）。TODO：0。
