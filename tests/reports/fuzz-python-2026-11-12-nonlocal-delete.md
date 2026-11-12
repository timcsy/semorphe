# 模糊測試報告 — Python — 2026-11-12（423：nonlocal 與 del）

沿用 11-12 盲測第二批（10 支，由看不到 repo 的出題代理寫、`python3` 跑出 expected），不另出新題：
這一刀的兩顆元件就是從這一批量出來的缺口。

## 摘要
- 產生的程式數：10；成功執行：10
- 轉一圈再轉一圈不動點：10/10
- SEMANTIC_DIFF／COMPILE_FAIL／ROUNDTRIP_DRIFT／SCAFFOLD_LEAK／WRONG_COMPONENT：0
- 跑得到 Cella 且輸出相同：fuzz_2（其餘見下）
- EXPECTED_DEGRADATION：fuzz_3、4、5、7（照實保留，見覆蓋缺口）
- Cella 不支援的標準模組：fuzz_1、6、8、9、10（`knownCellaGap` 釘住）

## 這一刀改變了什麼
| 程式 | 423 之前 | 423 之後 |
|---|---|---|
| fuzz_3 | `del b.rate` 與 `@staticmethod` 讓整個 class 照實保留 | `del` 收成 `python:delete`；class 只剩 `@staticmethod` 一個原因 |
| fuzz_7 | `nonlocal count` 讓 `make_counter` 整段照實保留 | 收成 `python:nonlocal`，Cella 跑出 `12 18` |

## 覆蓋缺口（下一刀）
- 裝飾器：`@staticmethod`（fuzz_3）、`@lru_cache(maxsize=None)`（fuzz_7；`functools` Cella 也不支援）
- 參數：`def total(*args, scale=1, **kw)`（fuzz_7）
- `match` 敘述（fuzz_4，兩處）
- 三段以上的比較鏈 `0 < x < 20 != 21`（fuzz_5；`compare_chain` 只收兩段）

## 產生的回歸測試
- `tests/integration/fuzz-python-student-2.test.ts`（12 支：10 支程式 ＋ 兩顆新元件各一支）；照實保留的清單是精確的，少一筆就紅
- `it.todo`：0
