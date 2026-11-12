# 概念探索：Python — nonlocal 與 del

## 摘要
- 語言：Python；目標：`nonlocal` 敘述、`del` 刪名字／屬性／多目標
- 發現概念：2（皆語言特定，lang-core）
- Topic：`python-beginner`（平的元件清單），接在 `python:global` 後面
- 來源：盲測第二批（11-12，隔離出題）fuzz_7 的 `nonlocal count`、fuzz_3 的 `del b.rate`；兩處今天都是 `unresolved` 整句降級

## 概念目錄

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|
| `python:nonlocal` | `nonlocal count` | 內層函式裡的指派改的是外面那層函式的變數 | 1 個名字欄位 | 特定 | raw_code | 形狀與 `python:global` 相同；`nonlocal a, b` 多名字照 global 的作法降級 |
| `python:delete` | `del x`、`del o.attr`、`del a, b[0]` | 讓名字消失、拿掉物件的屬性、一次刪好幾個 | 可增減的目標插槽（每格左值：名字／屬性／索引） | 特定 | raw_code | 單一 `del d[k]` 仍歸 `python:container_erase`（策略回 null 才輪到這顆，priority 較低） |

## Cella 對應
- `sNonlocal {names}`、`sDelete {targets}`——Cella 自己的前端（`tools/python/py_to_json.py:141-142`）就是這兩個形狀。
- 11-12 實測：含 `nonlocal`、`del o.r` 的程式直接送 Cella 判決器，`accept` 且輸出與 CPython 相同。

## 依賴與順序
1. `python:nonlocal`（獨立，最小）
2. `python:delete`（依賴 container_erase 讓出非「單一索引」的情況）

## 跨語言對應
C++ 兩者皆無（作用域靜態、沒有「讓名字消失」），`abstractComponent: null`。

## 邊界案例
- `del x` 之後再讀 `x` 是 NameError——Cella 照實判 reject，不是我們的事。
- `del (a), [b]` 這種括號／串列目標 → 降級（收不下就整句誠實降級）。
- `del a[1:3]` 切片目標：索引節點裡是切片——Cella 的切片物件要等 Python 新版；先照實送，判不出由 Cella 回 unknown。
