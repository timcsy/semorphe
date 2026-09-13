# 概念探索：C++ — `<stack>`

## 摘要
- 語言：C++
- 目標：`<stack>` 標頭檔
- 發現概念總數：5（全部為語言特定概念，已存在於 concepts.json）
- 通用概念：0、語言特定概念：5
- 建議歸屬的 Topic 層級樹節點：
  - L3a（初學 C++ 的「STL 容器操作」）：全部 5 個
  - L2a（競程 C++ 的「STL 容器」）：全部 5 個

## 概念目錄

### L3a: STL 容器操作 — Stack 容器

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| cpp_stack_declare | `stack<int> s;` | 宣告一個 LIFO 堆疊 | TYPE, NAME | lang-library | 特定 | var_declare | 經 template_type lifter |
| cpp_stack_push | `s.push(x)` | 將元素壓入頂端 | OBJ, VALUE | lang-library | 特定 | func_call | METHOD_TO_CONCEPT dispatch |
| cpp_stack_pop | `s.pop()` | 移除頂端元素 | OBJ | lang-library | 特定 | func_call | METHOD_TO_CONCEPT dispatch |
| cpp_stack_top | `s.top()` | 取得頂端元素（不移除） | OBJ | lang-library | 特定 | func_call_expr | stack 獨有方法 |
| cpp_stack_empty | `s.empty()` | 檢查是否為空 | OBJ | lang-library | 特定 | func_call_expr | 共享方法，lifter 預設歸 vector |

## 四路完備性 Gate

| 概念 | lift | render | extract | generate | execute | 狀態 |
|---|---|---|---|---|---|---|
| cpp_stack_declare | ✅ template_type → liftDeclaration | ✅ blocks.json | ✅ renderMapping | ⚠️ codeTemplate stub | ✅ containers.ts | 需手寫 generator |
| cpp_stack_push | ✅ METHOD_TO_CONCEPT | ✅ blocks.json | ✅ renderMapping | ⚠️ codeTemplate stub | ✅ containers.ts | 需手寫 generator |
| cpp_stack_pop | ✅ METHOD_TO_CONCEPT | ✅ blocks.json | ✅ renderMapping | ⚠️ codeTemplate stub | ✅ containers.ts | 需手寫 generator |
| cpp_stack_top | ✅ METHOD_TO_CONCEPT | ✅ blocks.json | ✅ renderMapping | ⚠️ codeTemplate stub | ✅ containers.ts | 需手寫 generator |
| cpp_stack_empty | ⚠️ 歸入 cpp_vector_empty | ✅ blocks.json | ✅ renderMapping | ⚠️ codeTemplate stub | ✅ containers.ts | 需手寫 generator |

**關鍵缺口**：所有 5 個概念只有 codeTemplate（只在瀏覽器中有效），需要手寫 generator 才能在測試中通過 roundtrip。

## 依賴關係圖

```
cpp_stack_declare ← (無依賴)
cpp_stack_push ← cpp_stack_declare
cpp_stack_pop ← cpp_stack_declare, cpp_stack_push（需有元素才能 pop）
cpp_stack_top ← cpp_stack_declare, cpp_stack_push（需有元素才能 top）
cpp_stack_empty ← cpp_stack_declare
```

## 建議實作順序

1. cpp_stack_declare（基礎）
2. cpp_stack_push（最常用操作）
3. cpp_stack_top（存取頂端）
4. cpp_stack_pop（移除頂端）
5. cpp_stack_empty（檢查為空）

## 跨語言對應

| C++ stack | Python list-as-stack | Java Stack |
|---|---|---|
| push(x) | append(x) | push(x) |
| pop() | pop() | pop() |
| top() | lst[-1] | peek() |
| empty() | not lst / len(lst)==0 | isEmpty() |
| size() | len(lst) | size() |

## 需注意的邊界案例

1. **共享方法名稱消歧義**：
   - `.push()` 在 stack 和 queue 之間共享，lifter 預設歸 stack（最常見 LIFO 容器）
   - `.pop()` 在 stack 和 queue 之間共享，lifter 預設歸 stack
   - `.empty()` 和 `.size()` 在所有容器間共享，lifter 預設歸 vector
2. **stack 沒有迭代器**：無法 range-for 遍歷 stack，只能 pop 到空
3. **top() 返回引用**：可修改頂端元素，但教育場景主要用於讀取
4. **空 stack 呼叫 top()/pop() 是未定義行為**：教育重點

## 不納入的 stack 功能

- `s.size()` — 由共享的 `cpp_vector_size` 概念處理（生成相同語法 `.size()`）
- `s.emplace(args...)` — 進階優化，初學者用 push 即可
- `s.swap(other)` — 少見操作，教育價值低
- `std::stack<int, vector<int>>` — 自定底層容器，超出教育範圍
