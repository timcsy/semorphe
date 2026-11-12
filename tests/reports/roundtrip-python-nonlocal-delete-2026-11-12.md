# Round-Trip 測試結果（Python）— nonlocal 與 del（423，2026-11-12）

| # | 程式 | 概念 | 結果 | 細節 |
|---|------|------|------|------|
| 1 | closure_counter | nonlocal、巢狀函式、預設參數、for | ✅ PASS | Cella `10 11 13` 與 python3 相同 |
| 2 | nested_two_levels | nonlocal 跨兩層 | ✅ PASS | `10` |
| 3 | class_attr_delete | del 屬性、類別屬性 | ✅ PASS | 刪掉之後讀到類別上的 `0.02` |
| 4 | del_in_loop | 單一 `del d[k]`（container_erase）＋ `del xs[0], xs[1]`（delete） | ✅ PASS | 兩顆分工正確 |
| 5 | del_name_try | del 名字、`del y, z`、NameError 被 except 接住 | ✅ PASS | `gone ok` |

走真積木（無頭 Blockly）：`nonlocal` 在巢狀函式裡、`del b.rate`、`del a, xs[0], o.y`、`del x` 一字不差回來。
⚠️ 量測工具修正：走真積木那支把型別註記下拉換成產品那一份——空清單讓 `def f():` 回來多一個 `-> __custom__`（測試的假象，產品的下拉第一筆是「不指定」）。

信心分布：新元件皆 high（具名策略、結構完全對上）；raw_code／unresolved＝0。
二次 round-trip：5/5 不動點。

摘要：5/5 PASS，0 todo。
