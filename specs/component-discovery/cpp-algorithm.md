# 概念探索：C++ — `<algorithm>`

## 摘要
- 語言：C++
- 目標：`<algorithm>` 標頭檔
- 發現概念總數：6（教育核心函式）
- 通用概念：0、語言特定概念：6
- 建議歸屬的 Topic 層級樹節點：algorithms（進階）

## 概念目錄

### algorithms — 進階（depth 2+）

| 概念名稱 | 語法 | 語義意義 | 屬性/子節點 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| cpp_sort | `sort(v.begin(), v.end())` | 對範圍排序 | begin(text), end(text) | lang-library | 特定 | func_call | 已有 concepts/blocks |
| cpp_reverse | `reverse(v.begin(), v.end())` | 反轉範圍 | begin(text), end(text) | lang-library | 特定 | func_call | 新增 |
| cpp_fill | `fill(v.begin(), v.end(), val)` | 填充範圍 | begin(text), end(text) + value child | lang-library | 特定 | func_call | 新增 |
| cpp_min | `min(a, b)` | 取較小值 | children: a, b | lang-library | 特定 | func_call | 新增 |
| cpp_max | `max(a, b)` | 取較大值 | children: a, b | lang-library | 特定 | func_call | 新增 |
| cpp_swap | `swap(a, b)` | 交換兩變數 | a(text), b(text) | lang-library | 特定 | func_call | 已有 concepts/blocks/lifter |

### 不在此次範圍（進階迭代器概念）
- find — 需要迭代器比較（`!= v.end()`），回傳迭代器
- lower_bound/upper_bound — 需要迭代器概念
- count — 簡單但需要迭代器概念
- unique — 需要 erase-remove idiom

## 依賴關係圖
- cpp_sort/reverse/fill 都依賴 `.begin()`/`.end()` 迭代器語法
- cpp_min/max 獨立（純表達式）
- cpp_swap 獨立（已有 lifter）

## 建議實作順序
1. cpp_swap（lifter 已有，只需 generator）
2. cpp_min, cpp_max（純表達式，簡單）
3. cpp_sort（最常用的 algorithm 函式）
4. cpp_reverse（與 sort 相同模式）
5. cpp_fill（多一個 value 參數）

## 需注意的邊界案例
1. **begin/end 迭代器**：`sort(v.begin(), v.end())` 中的 `v.begin()`/`v.end()` 在 lift 時會被當成方法呼叫。需要存為 text 屬性。
2. **sort 與陣列**：`sort(arr, arr+n)` 用指標而非迭代器，AST 結構不同
3. **min/max 與三元比較**：學生常用 `if (a < b) min = a; else min = b;`，min/max 是更簡潔的替代
4. **自訂比較器**：`sort(v.begin(), v.end(), greater<int>())` 超出此次範疇
