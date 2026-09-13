# 概念探索：C++ — `<queue>`

## 摘要
- 語言：C++
- 目標：`<queue>` 標頭檔
- 發現概念總數：5（全部為語言特定概念，已存在於 concepts.json）
- 通用概念：0、語言特定概念：5
- 建議歸屬的 Topic 層級樹節點：L3a（STL 容器操作）

## 概念目錄

### L3a: STL 容器操作 — Queue 容器

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| cpp_queue_declare | `queue<int> q;` | 宣告一個 FIFO 佇列 | TYPE, NAME | lang-library | 特定 | var_declare | 經 template_type lifter |
| cpp_queue_push | `q.push(x)` | 將元素加入尾端 | OBJ, VALUE | lang-library | 特定 | func_call | 共享方法，lifter 預設歸 stack |
| cpp_queue_pop | `q.pop()` | 移除前端元素 | OBJ | lang-library | 特定 | func_call | 共享方法，lifter 預設歸 stack |
| cpp_queue_front | `q.front()` | 取得前端元素（不移除） | OBJ | lang-library | 特定 | func_call_expr | queue 獨有方法 |
| cpp_queue_empty | `q.empty()` | 檢查是否為空 | OBJ | lang-library | 特定 | func_call_expr | 共享方法，lifter 預設歸 vector |

## 四路完備性 Gate

| 概念 | lift | render | extract | generate | execute | 狀態 |
|---|---|---|---|---|---|---|
| cpp_queue_declare | ✅ template_type | ✅ blocks.json | ✅ renderMapping | ⚠️ codeTemplate stub | ✅ containers.ts | 需手寫 generator |
| cpp_queue_push | ⚠️ 歸入 cpp_stack_push | ✅ blocks.json | ✅ renderMapping | ⚠️ codeTemplate stub | ✅ containers.ts | 需手寫 generator |
| cpp_queue_pop | ⚠️ 歸入 cpp_stack_pop | ✅ blocks.json | ✅ renderMapping | ⚠️ codeTemplate stub | ✅ containers.ts | 需手寫 generator |
| cpp_queue_front | ✅ METHOD_TO_CONCEPT | ✅ blocks.json | ✅ renderMapping | ⚠️ codeTemplate stub | ✅ containers.ts | 需手寫 generator |
| cpp_queue_empty | ⚠️ 歸入 cpp_vector_empty | ✅ blocks.json | ✅ renderMapping | ⚠️ codeTemplate stub | ✅ containers.ts | 需手寫 generator |

## 依賴關係圖

```
cpp_queue_declare ← (無依賴)
cpp_queue_push ← cpp_queue_declare
cpp_queue_pop ← cpp_queue_declare, cpp_queue_push
cpp_queue_front ← cpp_queue_declare, cpp_queue_push
cpp_queue_empty ← cpp_queue_declare
```

## 需注意的邊界案例

1. `.push()` 和 `.pop()` 在 stack/queue 間共享，lifter 預設歸 stack（程式碼語法相同）
2. `.front()` 是 queue 獨有方法，可正確 lift
3. queue 沒有 `.back()` 方法（雖然底層 deque 有）
4. 空 queue 呼叫 front()/pop() 是未定義行為
