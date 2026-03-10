# Data Model: C++ Std Modules Reorganization

## Entities

### StdModule

對應一個 C++ 標準函式庫 header 的完整模組。

| 欄位 | 型別 | 說明 |
|------|------|------|
| header | string | C++ header 名稱，如 `'<iostream>'`、`'<vector>'` |
| concepts | ConceptDefJSON[] | 此模組定義的語意概念 |
| blocks | BlockProjectionJSON[] | 此模組定義的積木投影 |
| registerGenerators | function | 註冊此模組的程式碼生成器 |
| registerLifters | function | 註冊此模組的 code→blocks 轉換器 |

**唯一性**：每個 header 只有一個 StdModule 實例。

**關聯**：
- 一個 StdModule 包含 0..N 個 ConceptDefJSON
- 一個 StdModule 包含 0..N 個 BlockProjectionJSON
- 一個概念只能屬於一個 StdModule（或 Core）

### CoreModule

不需要 `#include` 的語言核心概念集合。

| 欄位 | 型別 | 說明 |
|------|------|------|
| concepts | ConceptDefJSON[] | 核心概念（if, for, var_declare, etc.） |
| blocks | BlockProjectionJSON[] | 核心積木投影 |
| registerGenerators | function | 註冊核心程式碼生成器 |
| registerLifters | function | 註冊核心 lifters |

**唯一性**：只有一個 CoreModule。

**關聯**：
- 與 StdModule 互斥——一個概念要麼屬於 Core，要麼屬於某個 StdModule

### ModuleRegistry

管理所有模組的注冊中心。

| 欄位 | 型別 | 說明 |
|------|------|------|
| modules | Map<string, StdModule> | header → StdModule 映射 |
| conceptToHeader | Map<string, string> | 概念 ID → header 反查映射 |

**能力**：
- `getHeaderForConcept(conceptId: string): string | null` — 查詢概念所屬 header
- `getRequiredHeaders(conceptIds: string[]): string[]` — 批次查詢並去重
- `getAllModules(): StdModule[]` — 取得所有 std 模組

## Entity Relationships

```
CoreModule (1) ──contains──> (N) ConceptDefJSON
CoreModule (1) ──contains──> (N) BlockProjectionJSON

StdModule (1) ──contains──> (N) ConceptDefJSON
StdModule (1) ──contains──> (N) BlockProjectionJSON
StdModule (1) ──declares──> (1) header name

ModuleRegistry (1) ──manages──> (N) StdModule
ModuleRegistry (1) ──indexes──> (N) concept-to-header mappings
```

## 概念歸屬完整映射

### Core（不需 #include）

控制流：if, while_loop, count_loop, for_loop, cpp_for_loop, cpp_do_while, cpp_switch, cpp_case, cpp_default, break, continue

宣告/賦值：var_declare, var_assign, var_ref, number_literal, string_literal, cpp_char_literal

函式：func_def, forward_decl, func_call_expr, return

運算：arithmetic, compare, logic, cpp_increment, cpp_compound_assign, cpp_bitwise_not, cpp_ternary, cpp_cast

陣列/指標：array_declare, array_access, array_assign, cpp_pointer_assign, cpp_pointer_deref, cpp_address_of

前處理：cpp_include, cpp_include_local, using_declaration

### std/iostream

print, input, endl

### std/cstdio

cpp_printf, cpp_scanf

### std/vector

vector_create, vector_push_back, vector_size, vector_at, vector_pop_back, vector_empty, vector_clear

### std/algorithm

algorithm_sort, algorithm_find, algorithm_reverse, algorithm_count, algorithm_min_element, algorithm_max_element, algorithm_transform

### std/string

string_length, string_substr, string_find, string_append, string_compare

### std/cmath

math_abs, math_sqrt, math_pow, math_ceil, math_floor, math_round
