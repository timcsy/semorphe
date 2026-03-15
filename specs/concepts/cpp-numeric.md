# 概念探索：C++ — `<numeric>`

## 摘要
- 語言：C++
- 目標：`<numeric>` 標頭檔
- 發現概念總數：5
- 通用概念：0、語言特定概念：5
- 建議歸屬的 Topic 層級樹節點：L3a（STL 容器操作）3 個、L1a（函式與迴圈）2 個

## 概念目錄

### L1a: 函式與迴圈 — 中級

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| `cpp_gcd` | `__gcd(a, b)` / `gcd(a, b)` | 求兩數最大公因數 | VALUE_A (expr), VALUE_B (expr) | lang-library | 特定 | `func_call` | C++17 std::gcd 或 __gcd |
| `cpp_lcm` | `lcm(a, b)` | 求兩數最小公倍數 | VALUE_A (expr), VALUE_B (expr) | lang-library | 特定 | `func_call` | C++17，常與 gcd 搭配 |

### L3a: STL 容器操作 — 進階

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| `cpp_accumulate` | `accumulate(b, e, init)` | 對範圍內元素累加 | BEGIN (field), END (field), INIT (expr) | lang-library | 特定 | `func_call` | **已存在**，需移除 codeTemplate |
| `cpp_iota` | `iota(b, e, value)` | 用遞增值填充範圍 | BEGIN (field), END (field), VALUE (expr) | lang-library | 特定 | `func_call` | 常用於初始化 0~N-1 陣列 |
| `cpp_partial_sum` | `partial_sum(b, e, dest)` | 計算前綴和 | BEGIN (field), END (field), DEST (field) | lang-library | 特定 | `func_call` | 競程必備技巧 |

## 依賴關係圖

```
cpp_gcd ──(無依賴)
cpp_lcm ──(無依賴)
cpp_accumulate ──► array/vector（需要容器）
cpp_iota ──► array/vector（需要容器）
cpp_partial_sum ──► array/vector（需要容器）
```

## 建議實作順序

1. `cpp_accumulate`（已存在，只需移除 codeTemplate、驗證）
2. `cpp_gcd`（簡單雙參數函式）
3. `cpp_lcm`（同 gcd 結構）
4. `cpp_iota`（需 begin/end field + value expr）
5. `cpp_partial_sum`（需 begin/end/dest 三個 field）

## 跨語言對應

| C++ 概念 | Python 對應 | Java 對應 |
|---|---|---|
| `accumulate` | `sum()` / `functools.reduce()` | `Stream.reduce()` |
| `gcd` | `math.gcd()` | `BigInteger.gcd()` |
| `lcm` | `math.lcm()` (3.9+) | 無內建 |
| `iota` | `range()` | `IntStream.range()` |
| `partial_sum` | `itertools.accumulate()` | 無內建 |

## 需注意的邊界案例

1. **gcd vs __gcd**：競程常用 `__gcd(a, b)`（GCC 擴充），C++17 有 `std::gcd`。lifter 需同時辨識兩者
2. **accumulate 的 std:: 前綴**：使用 `using namespace std` 時無前綴，否則需要 `std::accumulate`。現有 lifter 已處理
3. **iota 的語句性質**：`iota` 是語句（void 回傳），不是表達式，與 accumulate 不同
4. **partial_sum 的目標範圍**：目標可以是原始範圍（in-place）或另一個容器
5. **gcd/lcm 的標頭檔**：嚴格來說在 `<numeric>`（C++17），但 `__gcd` 在 `<algorithm>` 中
