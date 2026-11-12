# 模糊測試報告 — Python — 2026-11-12（第 424 刀：裝飾器）

沿用盲測第二批（2026-11-12，十支由看不到 repo 的出題代理寫、`python3` 跑出 expected），量裝飾器有了元件之後的變化。

## 摘要
- 程式數：10（全部可執行）
- 十支轉一圈再轉一圈都是不動點：SEMANTIC_DIFF 0、COMPILE_FAIL 0、ROUNDTRIP_DRIFT 0
- 🟢 fuzz_3：`@staticmethod` 收成 `python:decorated`，**整個 `class Account` 收下**（之前整段照實保留）。
  Cella 判決 unknown 只剩內建 `vars`（`knownCellaGap`）；拿掉 `vars` 那兩項，Cella 的輸出等於 python3。
- 🟢 fuzz_7：`@lru_cache(maxsize=None)` 收成 `python:decorated`；仍照實保留的只剩 `def total(*args, scale=1, **kw)`。
  Cella 那一側 `functools` 不支援（膠囊 `spec.test.ts` 用 `knownCellaGap` 釘著）。

## 發現的 Bug
無。

## 覆蓋缺口（照實保留，下一刀）
- `def total(*args, scale=1, **kw)`（fuzz_7）
- `match`（fuzz_4）
- 三段以上的比較鏈 `0 < x < 20 != 21`（fuzz_5）

## 回歸測試
- `tests/integration/fuzz-python-student-2.test.ts`：fuzz_3、fuzz_7 的照實保留清單更新（精確清單），fuzz_3 加 Cella 執行比對。
- TODO：0
