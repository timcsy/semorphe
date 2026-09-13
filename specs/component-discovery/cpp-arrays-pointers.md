# 概念探索：C++ — 陣列與指標

## 摘要
- 語言：C++
- 目標：arrays, 2d arrays, pointers, malloc, free, new, delete, address-of, dereference, reference, swap
- 發現概念總數：14
- 通用概念：3（array_declare, array_access, array_assign）
- 語言特定概念：11（cpp_array_2d_declare, cpp_array_2d_access, cpp_array_2d_assign, cpp_pointer_declare, cpp_pointer_deref, cpp_pointer_assign, cpp_address_of, cpp_malloc, cpp_free, cpp_new, cpp_delete）
- 標準函式庫概念：1（cpp_swap）
- 尚未存在的概念：1（cpp_reference_param — 目前不存在於任何概念或積木定義中）
- 建議歸屬的 Topic 層級樹節點：L2a（陣列 6 個）、L2b（指標與記憶體 8 個）、L3a（swap 1 個）

## 概念目錄

### L2a: 陣列與字串（已存在於 beginner topic）

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| array_declare | `int arr[10];` | 宣告固定大小的一維陣列 | type(field_dropdown), name(field_input), size(value_input) | universal | 通用 | raw_code | 已存在。積木 id = `u_array_declare`，codeTemplate = `${type} ${name}[${size}];` |
| array_access | `arr[i]` | 以索引存取陣列元素（作為表達式） | name(field_dropdown, 動態), index(value_input) | universal | 通用 | raw_expression | 已存在。積木 id = `u_array_access`，codeTemplate = `${name}[${index}]`，role = expression |
| array_assign | `arr[i] = val;` | 對陣列特定索引位置賦值 | name(field_dropdown, 動態), index(value_input), value(value_input) | universal | 通用 | raw_code | 已存在。積木 id = `u_array_assign`，role = statement |
| cpp_array_2d_declare | `int arr[3][4];` | 宣告二維陣列（矩陣） | type(field_dropdown), name(field_input), rows(field_input), cols(field_input) | lang-core | 特定 | raw_code | 已存在。積木 id = `c_array_2d_declare`。rows/cols 使用 field_input 而非 value_input（無法用表達式決定大小） |
| cpp_array_2d_access | `arr[i][j]` | 以雙索引存取二維陣列元素 | name(field_input), row(value_input), col(value_input) | lang-core | 特定 | raw_expression | 已存在。積木 id = `c_array_2d_access`，codeTemplate = `${NAME}[${ROW}][${COL}]`，role = expression |
| cpp_array_2d_assign | `arr[i][j] = val;` | 對二維陣列特定位置賦值 | name(field_input), row(value_input), col(value_input), value(value_input) | lang-core | 特定 | raw_code | 已存在。積木 id = `c_array_2d_assign`，role = statement |

### L2b: 指標與記憶體（已存在於 beginner topic）

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| cpp_pointer_declare | `int* ptr;` | 宣告一個指向特定型別的指標變數 | type(field_dropdown: int/float/double/char/void), name(field_input) | lang-core | 特定 | raw_code | 已存在。積木 id = `c_pointer_declare`，codeTemplate = `${TYPE}* ${NAME};`。無初始化器（不同於 var_declare） |
| cpp_pointer_deref | `*ptr` | 解參照指標，取得指向位址的值 | ptr(value_input) | lang-core | 特定 | raw_expression | 已存在。積木 id = `c_pointer_deref`，codeTemplate = `*${PTR}`，order = 8。lift-pattern 透過 pointer_expression + operator=`*` 辨識 |
| cpp_pointer_assign | `*ptr = val;` | 透過指標解參照進行賦值 | ptr_name(field_input), value(value_input) | lang-core | 特定 | raw_code | 已存在。積木 id = `c_pointer_assign`，codeTemplate = `*${PTR_NAME} = ${VALUE};`。注意 ptr_name 是 field（字串）而非 value_input |
| cpp_address_of | `&var` | 取得變數的記憶體位址 | var(value_input) | lang-core | 特定 | raw_expression | 已存在。積木 id = `c_address_of`，codeTemplate = `&${VAR}`，order = 8。lift-pattern 透過 pointer_expression + operator=`&` 辨識 |
| cpp_malloc | `(int*)malloc(n * sizeof(int))` | C 風格動態記憶體配置（含型別轉換和 sizeof） | type(field_dropdown), size(value_input), sizeof_type(field_dropdown) | lang-core | 特定 | raw_expression | 已存在。積木 id = `c_malloc`，imports = `["stdlib.h"]`，role = expression。需搭配 cpp_free 成對使用 |
| cpp_free | `free(ptr);` | 釋放由 malloc 配置的記憶體 | ptr(value_input) | lang-core | 特定 | raw_code | 已存在。積木 id = `c_free`，imports = `["stdlib.h"]`。lift-pattern 透過 call_expression + function=`free` 辨識 |

### L2c: 結構與類別（new/delete 歸於此層級）

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| cpp_new | `new MyClass(args)` | C++ 風格動態記憶體配置（呼叫建構子） | type(field_input), args(field_input) | lang-core | 特定 | raw_expression | 已存在。積木 id = `cpp_new`，category = `oop`，order = 8。args 為字串（技術債）。lift-pattern 使用 liftStrategy `cpp:liftNewExpression` |
| cpp_delete | `delete ptr;` | 釋放由 new 配置的記憶體（呼叫解構子） | ptr(value_input) | lang-core | 特定 | raw_code | 已存在。積木 id = `cpp_delete`，category = `oop`。lift-pattern 透過 delete_expression 辨識 |

### L3a: STL 容器操作（swap 歸於此層級）

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| cpp_swap | `std::swap(a, b);` | 交換兩個變數的值 | a(field_input), b(field_input) | lang-library | 特定 | raw_code | 已存在。積木 id = `cpp_swap`，imports = `["algorithm"]`，category = `algorithms`。abstractConcept = null（無通用對應）。a/b 均為 field_input（僅支援變數名稱，不支援表達式） |

### 尚未實作

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| cpp_reference_param | `void swap(int &a, int &b)` | 函式參數的傳址呼叫（reference parameter） | — | lang-core | 特定 | func_def（手動寫 `int&` 在 params 字串中） | **不存在**。目前 func_def 的 params 為自由文字字串，使用者可手動輸入 `int &a, int &b`，但無專屬概念或積木。若要結構化表達，需設計 param 積木子系統 |

## 依賴關係圖

```
var_declare ─────────────────┐
number_literal ──────────────┤
                             ▼
                    array_declare ──▶ array_access ──▶ array_assign
                             │
                             ▼
              cpp_array_2d_declare ──▶ cpp_array_2d_access ──▶ cpp_array_2d_assign
                             │
                             │  （概念上需要巢狀 count_loop 走訪）
                             ▼
                       count_loop / cpp_for_loop

var_declare ─────────────────┐
                             ▼
              cpp_pointer_declare ──▶ cpp_address_of    （取址：ptr = &var）
                             │           │
                             │           ▼
                             ├──▶ cpp_pointer_deref     （解參照：*ptr）
                             │           │
                             │           ▼
                             ├──▶ cpp_pointer_assign    （透過指標賦值：*ptr = val）
                             │
                             ▼
                ┌─── C 風格 ───┬─── C++ 風格 ───┐
                ▼              │                ▼
           cpp_malloc          │           cpp_new
                │              │                │
                ▼              │                ▼
           cpp_free            │           cpp_delete
                               │
                               ▼
                          cpp_swap（std::swap，獨立使用）

func_def ──▶ cpp_reference_param（尚未實作，目前透過 params 字串降級）
```

## 建議實作順序

由於所有概念（除 cpp_reference_param 外）皆已存在於概念定義和積木定義中，此處列出「若需補強」的優先順序：

### 第一優先：核心基礎陣列（已完成）
1. `array_declare` — 通用概念，已有 universal 積木和 codeTemplate
2. `array_access` — 通用概念，已有 universal 積木和 codeTemplate
3. `array_assign` — 通用概念，已有 universal 積木

### 第二優先：指標基礎（已完成）
4. `cpp_pointer_declare` — 已有積木、codeTemplate、astPattern
5. `cpp_address_of` — 已有積木、codeTemplate、astPattern、lift-pattern
6. `cpp_pointer_deref` — 已有積木、codeTemplate、astPattern、lift-pattern
7. `cpp_pointer_assign` — 已有積木、codeTemplate、astPattern

### 第三優先：動態記憶體（已完成）
8. `cpp_malloc` + `cpp_free` — 已有積木、codeTemplate，配對使用
9. `cpp_new` + `cpp_delete` — 已有積木、codeTemplate、lift-pattern，配對使用

### 第四優先：二維陣列（已完成）
10. `cpp_array_2d_declare` — 已有積木、codeTemplate
11. `cpp_array_2d_access` — 已有積木、codeTemplate
12. `cpp_array_2d_assign` — 已有積木、codeTemplate

### 第五優先：STL 工具（已完成）
13. `cpp_swap` — 已有積木、codeTemplate、renderMapping

### 第六優先：尚未實作
14. `cpp_reference_param` — 需要設計。目前 func_def 的 params 為字串型別（技術債），要結構化表達 pass-by-reference 需重新設計參數子系統或提供獨立的 reference 型別標註積木

## 跨語言對應

| 通用概念 | C++ 語法 | Python 對應 | Java 對應 | JavaScript 對應 |
|---|---|---|---|---|
| array_declare | `int arr[10];` | `arr = [0] * 10` | `int[] arr = new int[10];` | `let arr = new Array(10);` |
| array_access | `arr[i]` | `arr[i]` | `arr[i]` | `arr[i]` |
| array_assign | `arr[i] = v;` | `arr[i] = v` | `arr[i] = v;` | `arr[i] = v;` |
| array_2d_declare | `int a[3][4];` | `a = [[0]*4 for _ in range(3)]` | `int[][] a = new int[3][4];` | `Array.from({length:3}, ()=>Array(4).fill(0))` |
| array_2d_access | `a[i][j]` | `a[i][j]` | `a[i][j]` | `a[i][j]` |
| pointer_declare | `int* ptr;` | N/A（無指標） | N/A（無指標） | N/A（無指標） |
| pointer_deref | `*ptr` | N/A | N/A | N/A |
| address_of | `&var` | `id(var)`（語義不同） | N/A | N/A |
| malloc/free | `malloc()/free()` | N/A（GC） | N/A（GC） | N/A（GC） |
| new/delete | `new T()/delete p` | N/A（GC） | `new T()`（無 delete） | `new T()`（無 delete） |
| swap | `std::swap(a,b)` | `a, b = b, a` | 手動三步交換 | `[a, b] = [b, a]` |
| reference_param | `void f(int &x)` | 預設即 pass-by-reference（可變物件） | N/A（無 reference） | N/A（無 reference） |

## 需注意的邊界案例

### 1. 陣列與指標的隱含關係
C++ 中陣列名在大多數上下文自動退化為指標（array-to-pointer decay）。目前 Semorphe 將 `array_declare` 和 `cpp_pointer_declare` 視為完全獨立的概念，無法表達 `int* p = arr;` 這類指標指向陣列的用法。使用者需透過 `cpp_raw_code` 降級處理。

### 2. cpp_pointer_declare 無初始化器
`cpp_pointer_declare` 只宣告指標，不支援 `int* ptr = &x;` 的初始化語法。使用者需先宣告再用 `var_assign`（但 var_assign 的 name 是 field，不會生成 `ptr = &x` 而是 `ptr = &x;`）。實務上可能需要搭配 `cpp_raw_code`。

### 3. cpp_malloc 的型別同步
`cpp_malloc` 有兩個型別欄位：`TYPE`（轉型目標）和 `SIZEOF_TYPE`（sizeof 參數），使用者必須手動確保兩者一致（如 `(int*)malloc(n * sizeof(int))`），否則將產生型別不匹配的錯誤。目前無自動同步機制。

### 4. new/delete vs malloc/free 混用
`cpp_new` 歸類在 `oop` category，`cpp_malloc` 歸類在 `pointers` category。教學上應強調不可混用（new 配 delete、malloc 配 free），但積木系統無型別追蹤機制防止誤用。

### 5. cpp_swap 僅支援變數名稱
`cpp_swap` 的 a、b 均為 `field_input`（字串），無法 swap 陣列元素如 `swap(arr[i], arr[j])`。若需此用法，需降級為 `func_call` 或 `cpp_raw_code`。

### 6. cpp_reference_param 的缺失
pass-by-reference 是 C++ 教學中的核心概念，但目前無法結構化表達。func_def 的 params 是自由文字字串（技術債），使用者可寫 `int &a, int &b`，但語義層無法辨識這是 reference 參數。這影響到：
- 程式碼到積木的反向轉換（lifter 無法區分 value/reference 參數）
- 教學概念的漸進式展開（無法在 topic 中獨立控制 reference 的可見性）

### 7. 二維陣列的 rows/cols 為 field_input
`cpp_array_2d_declare` 的 rows 和 cols 使用 `field_input`（字串），而非 `value_input`（表達式）。這意味著無法用變數或運算式決定二維陣列大小，如 `int arr[n][m];` 需降級為 `cpp_raw_code`。這與 `array_declare` 的 size 使用 `value_input` 的設計不一致。

### 8. lift-pattern 覆蓋度
陣列概念（array_declare, array_access, array_assign, 2d 系列）在 `lift-patterns.json` 中未找到對應的 lift-pattern 條目，意味著程式碼轉積木（code-to-block）可能不支援這些概念的自動辨識。指標系列（address_of, pointer_deref, new, delete）已有 lift-pattern。
