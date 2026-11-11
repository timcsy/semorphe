# 379 · Python 的字典換成 map，而讀取經過一個小函式

> 日期：2026-11-11（405）
> 轉變：Python → C++ 遇到字典整支保留（`map_make`、`map_at_default`、`container_sort` 沒有 C++ 的寫法，`dict[…]` 對不上型別）。
> 改成：`dict[K, V]` → `map<K, V>`；讀 `d[k]` 經過補在開頭的 `map_at`、寫 `d[k] = v` 用 `[]`、`d.get(k, 預設)` 寫成 `count` 配三元運算子、`for k in sorted(d)` 走 map。課文 Python → C++ 換過去 27 → 28（共 36 支）。

## 讀與寫為什麼不同

Python 讀不存在的鍵拋 KeyError；C++ 的 `m[k]` 讀的時候會默默插入一筆預設值。所以只有寫入用 `[]`。

讀取本來想用 `m.at(k)`，Cella 回「std::map 沒有成員 at」。改成每一種 map 型別一份多載：

```cpp
long long map_at(const map<string, long long>& m, const string& k) {
    if (m.count(k) == 0) {
        throw out_of_range("KeyError");
    }
    return m.find(k)->second;
}
```

缺鍵時兩邊都是「沒接住的例外」結束，Cella 都判 accept 並列 `uncaught`。寫成一支有兩個型別參數的函式樣板比較短，但我們的 C++ lift 收不進 `template <typename K, typename V>`（整段降成原文），所以先展開成多載。

`d[k] += v` 寫成 `d[k] = map_at(d, k) + v`：C++17 的 `=` 先算右邊，讀在插入之前，缺鍵照樣丟例外。

## 只換得過去的走訪

C++ 的 map 照鍵排序走訪，Python 的字典照放入的順序。所以只有 `for k in sorted(d)` 換得過去（兩邊同一個順序），直接 `for k in d` 照實保留。`sorted(d)` 先拷了一份鍵，本體改那個字典時 C++ 會邊走邊變，也保留。

## 還沒做的

- 有內容的字典字面量：重複的鍵 Python 取後面那個、C++ 的初始化串列取前面那個。先只換空的 `{}`。
- `09/ex1`、`12/ex1`：照放入順序走訪、`max` 的平手取第一個——意思不同，照舊保留。
- 兩個型別參數的函式樣板 lift 不進來：另排一刀（學生程式也會寫）。
- 回報 Cella：`std::map::at`。
