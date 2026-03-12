# Round-Trip 測試報告 — C++ Arrays & Pointers — 2026-03-12

## 摘要
- 語言：C++
- 測試程式數：10
- PASS：9
- ROUNDTRIP_DRIFT：1（swap 函式名與 cpp_swap 概念衝突）

## 新增的實作

### 新增 Generator
- `cpp_pointer_declare`：`int* ptr = val;`
- `cpp_new`：`new int`
- `cpp_delete`：`delete ptr;`
- `cpp_malloc`：`(int*)malloc(n * sizeof(int))`
- `cpp_free`：`free(ptr);`

### 新增 Lift Pattern
- `new_expression` → `cpp_new`（含 liftStrategy）
- `delete_expression` → `cpp_delete`

### 新增 Executor
- `cpp_pointer_declare`、`cpp_new`、`cpp_delete`、`cpp_malloc`、`cpp_free`

## 已知限制
- `swap(int&, int&)` 被 lifter 誤識別為 `cpp_swap` 概念
- interpreter 的 `new` 語義簡化（不支援真正的堆記憶體分配）

## 產生的回歸測試
- `tests/integration/roundtrip-arrays-pointers.test.ts`（19 PASS + 1 todo）
- `tests/integration/fuzz-cpp-arrays-pointers.test.ts`（11 PASS + 2 todo）
