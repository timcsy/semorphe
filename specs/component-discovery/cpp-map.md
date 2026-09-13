# 概念探索：C++ — `<map>`

## 摘要
- 語言：C++
- 目標：`<map>` 標頭檔（`std::map`）
- 發現概念總數：5
- 通用概念：0、語言特定概念：5
- 建議歸屬的 Topic 層級樹節點：containers（進階）

## 概念目錄

### containers — 進階（depth 2+）

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| cpp_map_declare | `map<K,V> m;` | 宣告 key-value 映射容器 | KEY_TYPE, VALUE_TYPE, NAME | lang-library | 特定 | var_declare | 需拆分 key_type/value_type |
| cpp_map_access | `m[key]` | 以 key 存取或插入值 | OBJ, KEY | lang-library | 特定 | raw_code | subscript_expression |
| cpp_map_erase | `m.erase(key)` | 移除指定 key 的元素 | OBJ, KEY | lang-library | 特定 | func_call | METHOD_TO_CONCEPT 已有 |
| cpp_map_count | `m.count(key)` | 檢查 key 是否存在（回傳 0/1） | OBJ, KEY | lang-library | 特定 | func_call | METHOD_TO_CONCEPT 已有 |
| cpp_map_empty | `m.empty()` | 檢查是否為空 | OBJ | lang-library | 特定 | func_call | 共用 cpp_vector_empty |

## 依賴關係圖
- cpp_map_access → cpp_map_declare（需先宣告 map）
- cpp_map_erase → cpp_map_declare
- cpp_map_count → cpp_map_declare
- cpp_map_empty → cpp_map_declare（但 lifter 共用 cpp_vector_empty）

## 建議實作順序
1. cpp_map_declare（基礎，修正 key_type/value_type 拆分）
2. cpp_map_access（subscript 運算子，需新增 lifter）
3. cpp_map_erase（方法呼叫，lifter 已有）
4. cpp_map_count（方法呼叫，lifter 已有）
5. cpp_map_empty（共用 cpp_vector_empty）

## 需注意的邊界案例
1. **declare 屬性拆分**：liftDeclaration 目前只設 `type`，map 需要拆為 `key_type` + `value_type`
2. **map_access 的 subscript**：`m[key]` 在 tree-sitter 是 `subscript_expression`，也被陣列使用，需區分
3. **map_empty 共用**：lifter 的 METHOD_TO_CONCEPT 把 `.empty()` 映射到 `cpp_vector_empty`，但 generator 端 map_empty 概念也需要有 generator（即使 lift 時不會產生 cpp_map_empty）
4. **map_access 的 assign**：`m[key] = val` 形式需要能在 assign 左邊出現
5. **pair iteration**：`for (auto& p : m)` 中 pair 的解構不在此次範疇

## 跨語言對應
- Python: `dict` 操作（`d[key]`、`del d[key]`、`key in d`、`len(d)`）
- Java: `Map.get()`, `Map.put()`, `Map.remove()`, `Map.containsKey()`
