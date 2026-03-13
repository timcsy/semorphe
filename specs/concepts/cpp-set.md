# 概念探索：C++ — `<set>`

## 摘要
- 語言：C++
- 目標：`<set>` 標頭檔（`std::set`）
- 發現概念總數：5
- 通用概念：0、語言特定概念：5
- 建議歸屬的 Topic 層級樹節點：containers（進階）

## 概念目錄

### containers — 進階（depth 2+）

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| cpp_set_declare | `set<T> s;` | 宣告有序唯一集合 | TYPE, NAME | lang-library | 特定 | var_declare | template_type 偵測 |
| cpp_set_insert | `s.insert(val)` | 插入元素（重複忽略） | OBJ, VALUE | lang-library | 特定 | func_call | METHOD_TO_CONCEPT 已有 |
| cpp_set_erase | `s.erase(val)` | 移除元素 | OBJ, VALUE | lang-library | 特定 | func_call | 共用 cpp_map_erase lifter |
| cpp_set_count | `s.count(val)` | 檢查是否存在（0/1） | OBJ, VALUE | lang-library | 特定 | func_call | 共用 cpp_map_count lifter |
| cpp_set_empty | `s.empty()` | 檢查是否為空 | OBJ | lang-library | 特定 | func_call | 共用 cpp_vector_empty lifter |

## 依賴關係圖
- cpp_set_insert/erase/count/empty → cpp_set_declare

## 建議實作順序
1. cpp_set_declare（基礎）
2. cpp_set_insert（唯一的 set-specific lifter 映射）
3. cpp_set_erase（共用 map_erase lifter）
4. cpp_set_count（共用 map_count lifter）
5. cpp_set_empty（共用 vector_empty lifter）

## 需注意的邊界案例
1. **erase/count 共用 map 概念**：lifter 把 `.erase()` 和 `.count()` 映射到 map 版本，但語義上 set 用 value 而非 key。Generator 都正確產生 `.erase(val)`/`.count(val)`。
2. **set 不支援 `[]` 操作**：與 map 不同，set 無下標存取。
3. **insert 回傳 pair**：`s.insert(val)` 回傳 `pair<iterator, bool>`，但初學者通常忽略回傳值。
