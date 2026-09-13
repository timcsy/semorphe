# 概念探索：C++ — `<vector>`

## 摘要
- 語言：C++
- 目標：`<vector>` 標頭檔
- 發現概念總數：7（全部為現有概念，需補完 generator/lifter）
- 通用概念：0、語言特定概念：7
- 建議歸屬的 Topic 層級樹節點：
  - L2a（初學 C++ 的「陣列與字串」）：cpp_vector_declare, cpp_vector_push_back, cpp_vector_size（3 個基礎）
  - L3a（初學 C++ 的「STL 容器操作」）：cpp_vector_pop_back, cpp_vector_clear, cpp_vector_empty, cpp_vector_back（4 個進階）
  - L2a（競程 C++ 的「STL 容器」）：全部 7 個

## 概念目錄

### L2a: 陣列與字串 — 基礎 vector 操作

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| cpp_vector_declare | `vector<int> v;` | 宣告一個動態陣列 | TYPE, NAME | lang-library | 特定 | var_declare | 需 template_type lifter |
| cpp_vector_push_back | `v.push_back(x)` | 尾端新增元素 | VECTOR, VALUE | lang-library | 特定 | func_call | 共享方法，走 METHOD_TO_CONCEPT |
| cpp_vector_size | `v.size()` | 取得元素數量 | VECTOR | lang-library | 特定 | func_call_expr | 共享方法，走 METHOD_TO_CONCEPT |

### L3a: STL 容器操作 — 進階 vector 操作

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| cpp_vector_pop_back | `v.pop_back()` | 移除尾端元素 | VECTOR | lang-library | 特定 | func_call | 共享方法 |
| cpp_vector_clear | `v.clear()` | 清空所有元素 | VECTOR | lang-library | 特定 | func_call | 共享方法，string 也有 |
| cpp_vector_empty | `v.empty()` | 檢查是否為空 | VECTOR | lang-library | 特定 | func_call_expr | 共享方法，string 也有 |
| cpp_vector_back | `v.back()` | 取得尾端元素 | VECTOR | lang-library | 特定 | func_call_expr | 共享方法 |

## 四路完備性 Gate

| 概念 | lift | render | extract | generate | execute | 狀態 |
|---|---|---|---|---|---|---|
| cpp_vector_declare | ✅ template_type → liftDeclaration | ✅ blocks.json | ✅ renderMapping | ✅ generators.ts | ✅ containers.ts | 完備 |
| cpp_vector_push_back | ✅ METHOD_TO_CONCEPT | ✅ blocks.json | ✅ renderMapping | ✅ generators.ts | ✅ containers.ts | 完備 |
| cpp_vector_size | ✅ METHOD_TO_CONCEPT | ✅ blocks.json | ✅ renderMapping | ✅ generators.ts | ✅ containers.ts | 完備 |
| cpp_vector_pop_back | ✅ METHOD_TO_CONCEPT | ✅ blocks.json | ✅ renderMapping | ✅ generators.ts | ✅ containers.ts | 完備 |
| cpp_vector_clear | ✅ METHOD_TO_CONCEPT | ✅ blocks.json | ✅ renderMapping | ✅ generators.ts | ✅ containers.ts | 完備 |
| cpp_vector_empty | ✅ METHOD_TO_CONCEPT | ✅ blocks.json | ✅ renderMapping | ✅ generators.ts | ✅ containers.ts | 完備 |
| cpp_vector_back | ✅ METHOD_TO_CONCEPT | ✅ blocks.json | ✅ renderMapping | ✅ generators.ts | ✅ containers.ts | 完備 |

## 已完成的修復

### 1. Lifter 方法衝突（已修復）
Phase 8 在 `tryMethodCallLift` 中加入了共享方法（empty, clear, push_back），攔截了 vector 方法呼叫。
- **修復**：重構為 `tryStringMethodLift`，只處理 string-only 方法，共享方法回傳 null 由 METHOD_TO_CONCEPT dispatch
- **消歧義規則**：`erase(pos,len)` 2 args → string；`erase(key)` 1 arg → container。`insert(pos,val)` 2 args → string；`insert(val)` 1 arg → set

### 2. template_type lifter（已修復）
`vector<int> v;` 的 tree-sitter AST 為 `declaration` + `template_type`，原 `liftDeclaration` strategy 不認識 `template_type`。
- **修復**：在 `liftDeclaration` strategy 中加入 template_type 偵測，辨識 vector/stack/queue/set/map/pair 容器宣告

### 3. Hand-written generators（已完成）
`src/languages/cpp/std/vector/generators.ts` 原為 codeTemplate stub，已替換為手寫 generators。

## 依賴關係圖

```
cpp_vector_declare ← (無依賴)
cpp_vector_push_back ← cpp_vector_declare
cpp_vector_size ← cpp_vector_declare
cpp_vector_pop_back ← cpp_vector_declare, cpp_vector_push_back（需有元素才能 pop）
cpp_vector_clear ← cpp_vector_declare
cpp_vector_empty ← cpp_vector_declare
cpp_vector_back ← cpp_vector_declare, cpp_vector_push_back（需有元素才能 back）
```

## 建議實作順序

1. cpp_vector_declare（基礎，其他概念依賴）
2. cpp_vector_push_back（最常用的修改操作）
3. cpp_vector_size（最常用的查詢操作）
4. cpp_vector_empty、cpp_vector_back（查詢操作）
5. cpp_vector_pop_back、cpp_vector_clear（修改操作）

## 跨語言對應

| C++ vector | Python list | Java ArrayList |
|---|---|---|
| push_back(x) | append(x) | add(x) |
| pop_back() | pop() | remove(size()-1) |
| size() | len(lst) | size() |
| empty() | not lst / len(lst)==0 | isEmpty() |
| clear() | clear() | clear() |
| back() | lst[-1] | get(size()-1) |
| v[i] | lst[i] | get(i) |

目前僅支援 C++，無需跨語言同步。

## 不納入的 vector 功能

- `v.front()` — 教育場景少用，可用 `v[0]` 替代
- `v.reserve()` / `v.capacity()` — 效能優化，非基礎概念
- `v.resize()` — 進階操作，初學者不常用
- `v.begin()` / `v.end()` — 迭代器概念，由 sort/accumulate 隱含使用
- `v.at()` — bounds checking 版本，教育場景用 `v[i]`（已由 array_access 處理）
- `v.insert()` / `v.erase()` — 中間插入/刪除，O(n) 效能，進階且易混淆
- `v.emplace_back()` — 進階最佳化，初學者用 push_back 即可
- `v.data()` — 指標操作，非教育重點

## 需注意的邊界案例

1. **共享方法名稱**：push_back, pop_back, clear, empty, back, size 在 vector/string/deque 等容器間共用。無型別資訊時，lifter 統一歸為 vector 概念（最常見容器）
2. **template_type 解析**：`vector<int>` vs `vector<string>` vs `vector<pair<int,int>>` — 巢狀模板的 innerType 可能很複雜
3. **初始化語法多樣**：`vector<int> v;` vs `vector<int> v(10, 0);` vs `vector<int> v = {1,2,3};` — 目前只支援空宣告
4. **`v[i]` 存取**：由通用 `array_access` 概念處理，不屬於 vector 模組
