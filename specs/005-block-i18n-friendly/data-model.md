# Data Model: 積木文字改動清單

**Date**: 2026-03-04

## 實體說明

本功能只改動 Block Definition 的三個屬性：
- **message**: 積木上顯示的文字（Blockly message0/message1/message2）
- **tooltip**: 滑鼠 hover 時的說明文字
- **dropdown label**: 下拉選單的顯示標籤（`options[n][0]`），value（`options[n][1]`）不動

## 型別下拉標準對照表

所有積木共用，統一 label 格式：

| Value | Label |
|-------|-------|
| int | int（整數） |
| float | float（小數） |
| double | double（精確小數） |
| char | char（字元） |
| long long | long long（大整數） |
| string / std::string | string（文字） |
| bool | bool（是/否） |
| void | void（無回傳） |

## Universal 積木改動（universal.json — 22 個）

### 資料類別（data）

| ID | 欄位 | 目前 | 改為 |
|----|------|------|------|
| u_var_declare | message0 | `建立 %1 變數 %2 = %3` | `建立 %1 變數 %2 = %3`（不變） |
| u_var_declare | tooltip | `建立一個新變數並設定初始值` | `建立一個新的變數，可以選擇型別和初始值。變數就像一個有名字的盒子，用來存放資料` |
| u_var_declare | TYPE dropdown | `int/float/double/...` | 套用型別下拉標準對照表 |
| u_var_assign | message0 | `把 %1 設成 %2` | `把變數 %1 設成 %2` |
| u_var_assign | tooltip | `將變數設定為新的值` | `把已經建立的變數改成新的值` |
| u_var_ref | tooltip | `取得變數的值` | `使用這個變數目前存放的值` |
| u_number | tooltip | `數字常數` | `輸入一個數字，可以用在計算或比較中` |
| u_string | tooltip | `字串常數` | `輸入一段文字內容，前後會自動加上引號` |

### 運算類別（operators）

| ID | 欄位 | 目前 | 改為 |
|----|------|------|------|
| u_arithmetic | tooltip | `算術運算` | `把兩個數字做加、減、乘、除或取餘數的計算` |
| u_compare | tooltip | `比較運算` | `比較兩個值的大小或是否相等，結果是「是」或「否」` |
| u_logic | tooltip | `邏輯運算（而且 / 或者）` | `組合兩個條件：「而且」表示兩個都要成立，「或者」表示只要一個成立就行` |
| u_logic_not | tooltip | `邏輯否定` | `把條件反過來：「是」變「否」，「否」變「是」` |

### 控制類別（control）

| ID | 欄位 | 目前 | 改為 |
|----|------|------|------|
| u_count_loop | tooltip | `計數式重複迴圈` | `讓程式重複執行：變數會從起始值一直數到結束值，每次加 1` |
| u_while_loop | tooltip | `當條件成立時持續執行` | 不變（已夠白話） |
| u_break | tooltip | `跳出目前的迴圈` | `立刻停止迴圈，不再重複` |
| u_continue | tooltip | `跳過本次迴圈，直接執行下一次` | 不變（已夠白話） |

### 函式類別（functions）

| ID | 欄位 | 目前 | 改為 |
|----|------|------|------|
| u_func_def | message0 | `定義函式 %1（%2）回傳 %3` | 不變（已有「函式」身份標示） |
| u_func_def | tooltip | `定義一個函式` | `定義一個函式（可重複使用的程式片段）。選擇 void（無回傳）表示不需要回傳結果` |
| u_func_def | RETURN_TYPE dropdown | `void/int/float/...` | 套用型別下拉標準對照表 |
| u_func_call | message0 | `呼叫 %1（%2）` | `呼叫函式 %1（%2）` |
| u_func_call | tooltip | `呼叫一個函式` | `執行指定的函式，可以傳入參數` |
| u_return | tooltip | `從函式回傳一個值` | `結束函式的執行，並把結果送回去給呼叫的地方` |

### 輸入輸出類別（io）

| ID | 欄位 | 目前 | 改為 |
|----|------|------|------|
| u_print | tooltip | `輸出一個或多個值到螢幕上` | 不變（已夠白話） |
| u_endl | tooltip | `輸出換行符號` | `讓輸出內容換到下一行` |
| u_input | message0 | `讀取輸入 → %1` | `讀取輸入 → 變數 %1` |
| u_input | tooltip | `從鍵盤讀取一個值到變數中` | 不變（已夠白話） |

### 陣列類別（arrays）

| ID | 欄位 | 目前 | 改為 |
|----|------|------|------|
| u_array_declare | tooltip | `建立一個固定大小的陣列` | `建立一個固定大小的陣列（一排連續的格子），索引從 0 開始` |
| u_array_declare | TYPE dropdown | `int/float/double/...` | 套用型別下拉標準對照表 |
| u_array_access | message0 | `%1 [ %2 ]` | `陣列 %1 的第 [ %2 ] 格` |
| u_array_access | tooltip | `存取陣列中的某個元素` | `取得或設定陣列中指定位置的值，索引從 0 開始` |

## Basic 積木改動（basic.json — 10 個）

| ID | 欄位 | 目前 | 改為 |
|----|------|------|------|
| c_char_literal | message0 | `' %1 '` | `字元 ' %1 '` |
| c_char_literal | tooltip | `字元字面值` | `輸入一個字元（單一文字），用單引號包起來` |
| c_increment | message0 | `%1 %2` | `變數 %1 %2` |
| c_increment | OP dropdown | `++/--` | `["加 1（++）","++"],["減 1（--）","--"]` |
| c_increment | tooltip | `遞增/遞減` | `讓變數的值加 1 或減 1` |
| c_compound_assign | message0 | `%1 %2 %3 ;` | `把變數 %1 %2 %3` |
| c_compound_assign | OP dropdown | `+=/-=/*=/÷=/%%=` | `["加上（+=）","+="],["減去（-=）","-="],["乘以（*=）","*="],["除以（/=）","/="],["取餘數（%=）","%="]` |
| c_compound_assign | tooltip | `複合賦值運算` | `把變數的值加上、減去、乘以、除以或取餘數後存回去` |
| c_switch | message0 | `switch ( %1 )` | `根據 %1 的值` |
| c_switch | tooltip | `switch 陳述句` | `根據一個值來決定要執行哪一段程式，類似多個「如果」的快捷寫法` |
| c_case | message0 | `case %1 :` | `當值為 %1 :` |
| c_case | tooltip | `case 標籤` | `當上面的值等於這個值時，就執行這段程式` |
| c_for_loop | message0 | `for ( %1 ; %2 ; %3 )` | `自訂重複：初始 %1 ；條件 %2 ；更新 %3` |
| c_for_loop | message1 | `do %1` | `執行 %1` |
| c_for_loop | tooltip | `for 迴圈` | `自訂的重複迴圈：先設定初始值，每次檢查條件，通過就執行，然後更新` |
| c_do_while | message0 | `do %1` | `先執行 %1` |
| c_do_while | message1 | `while ( %1 ) ;` | `當 %1 繼續重複` |
| c_do_while | tooltip | `do-while 迴圈` | `先執行一次裡面的程式，然後檢查條件，成立就繼續重複` |
| c_printf | message0 | `printf ( "%1" %2 ) ;` | `格式輸出 " %1 " %2` |
| c_printf | tooltip | `printf 格式化輸出` | `用格式字串輸出內容。常用格式：%d 整數、%f 小數、%s 文字、\\n 換行` |
| c_scanf | message0 | `scanf ( "%1" %2 ) ;` | `格式輸入 " %1 " %2` |
| c_scanf | tooltip | `scanf 格式化輸入` | `用格式字串讀取輸入。變數前要加 &（取址符號），如 &x` |

## Advanced 積木改動（advanced.json — 27 個）

### 指標類別（pointers）

| ID | 欄位 | 目前 | 改為 |
|----|------|------|------|
| c_pointer_declare | message0 | `%1 * %2 ;` | `建立 %1 指標變數 %2` |
| c_pointer_declare | tooltip | `指標宣告` | `建立一個指標變數。指標是一個記住其他變數位址的變數，就像寫著地址的紙條` |
| c_pointer_declare | TYPE dropdown | `int/float/double/char/void` | 套用型別下拉標準對照表 |
| c_pointer_deref | message0 | `* %1` | `取出 %1 指向的值` |
| c_pointer_deref | tooltip | `指標解參考` | `根據指標記住的位址，取出那個位置存放的值` |
| c_address_of | message0 | `& %1` | `取得 %1 的位址` |
| c_address_of | tooltip | `取址運算` | `取得變數在記憶體中的位址，可以存到指標裡` |
| c_malloc | message0 | `(%1 *) malloc ( %2 * sizeof(%3) )` | `配置 %2 個 %3 的記憶體空間（%1 指標）` |
| c_malloc | tooltip | `malloc 動態配置` | `向系統要一塊記憶體空間來使用，用完記得用 free 歸還` |
| c_malloc | TYPE/SIZEOF_TYPE dropdown | `int/float/double/char` | 套用型別下拉標準對照表（無 void/string/bool/long long） |
| c_free | message0 | `free ( %1 ) ;` | `釋放記憶體 %1` |
| c_free | tooltip | `free 釋放記憶體` | `把之前用 malloc 要來的記憶體歸還給系統` |

### 結構類別（structures）

| ID | 欄位 | 目前 | 改為 |
|----|------|------|------|
| c_struct_declare | message0 | `struct %1` | `定義結構 %1` |
| c_struct_declare | tooltip | `結構體宣告` | `定義一個結構，把多個相關的變數組合在一起，像是一張有多個欄位的表格` |
| c_struct_member_access | message0 | `%1 . %2` | `結構 %1 的欄位 %2` |
| c_struct_member_access | tooltip | `結構體成員存取` | `取得或設定結構裡某個欄位的值` |
| c_struct_pointer_access | message0 | `%1 -> %2` | `指標 %1 的欄位 %2` |
| c_struct_pointer_access | tooltip | `指標結構體成員存取` | `透過指標來取得或設定結構裡某個欄位的值` |

### 字串類別（strings）

| ID | 欄位 | 目前 | 改為 |
|----|------|------|------|
| c_strlen | message0 | `strlen ( %1 )` | `文字長度（ %1 ）` |
| c_strlen | tooltip | `字串長度` | `計算文字有幾個字元（不含結尾符號）` |
| c_strcmp | message0 | `strcmp ( %1 , %2 )` | `比較文字（ %1 , %2 ）` |
| c_strcmp | tooltip | `字串比較` | `比較兩段文字是否相同。回傳 0 表示一樣，其他數字表示不同` |
| c_strcpy | message0 | `strcpy ( %1 , %2 ) ;` | `複製文字 %2 到 %1` |
| c_strcpy | tooltip | `字串複製` | `把一段文字複製到另一個位置` |

### 容器類別（containers）

| ID | 欄位 | 目前 | 改為 |
|----|------|------|------|
| cpp_vector_declare | message0 | `vector < %1 > %2 ;` | `建立 %1 列表變數 %2` |
| cpp_vector_declare | tooltip | `vector 容器宣告` | `建立一個列表（可變長度的陣列），可以隨時加入或移除元素` |
| cpp_vector_declare | TYPE dropdown | `int/float/double/char/string/long long` | 套用型別下拉標準對照表 |
| cpp_vector_push_back | message0 | `%1 .push_back ( %2 ) ;` | `在列表 %1 尾端加入 %2` |
| cpp_vector_push_back | tooltip | `vector 加入元素` | `在列表的最後面加入一個新元素` |
| cpp_vector_size | message0 | `%1 .size()` | `列表 %1 的長度` |
| cpp_vector_size | tooltip | `vector 取得大小` | `取得列表裡有幾個元素` |
| cpp_map_declare | message0 | `map < %1 , %2 > %3 ;` | `建立對照表變數 %3（鍵 %1 值 %2）` |
| cpp_map_declare | tooltip | `map 容器宣告` | `建立一個對照表，用一個「鍵」來查詢對應的「值」，像字典一樣` |
| cpp_map_declare | KEY_TYPE dropdown | `int/string/char` | 套用型別下拉標準對照表 |
| cpp_map_declare | VALUE_TYPE dropdown | `int/float/double/string` | 套用型別下拉標準對照表 |
| cpp_string_declare | message0 | `string %1 ;` | `建立文字變數 %1` |
| cpp_string_declare | tooltip | `C++ string 宣告` | `建立一個文字變數，可以存放和處理一段文字` |
| cpp_stack_declare | message0 | `stack < %1 > %2 ;` | `建立 %1 堆疊變數 %2` |
| cpp_stack_declare | tooltip | `stack 容器宣告` | `建立一個堆疊，像疊盤子一樣，最後放的最先拿出來（後進先出）` |
| cpp_stack_declare | TYPE dropdown | `int/float/string/char` | 套用型別下拉標準對照表 |
| cpp_queue_declare | message0 | `queue < %1 > %2 ;` | `建立 %1 佇列變數 %2` |
| cpp_queue_declare | tooltip | `queue 容器宣告` | `建立一個佇列，像排隊一樣，最先來的最先處理（先進先出）` |
| cpp_queue_declare | TYPE dropdown | `int/float/string/char` | 套用型別下拉標準對照表 |
| cpp_set_declare | message0 | `set < %1 > %2 ;` | `建立 %1 集合變數 %2` |
| cpp_set_declare | tooltip | `set 容器宣告` | `建立一個集合，裡面的元素不會重複，而且會自動排序` |
| cpp_set_declare | TYPE dropdown | `int/float/string/char` | 套用型別下拉標準對照表 |
| cpp_method_call | message0 | `%1 . %2 ( %3 ) ;` | `對 %1 執行 %2（ %3 ）` |
| cpp_method_call | tooltip | `方法呼叫` | `對物件執行一個操作（方法），可以傳入參數` |
| cpp_method_call_expr | message0 | `%1 . %2 ( %3 )` | `對 %1 執行 %2（ %3 ）的結果` |
| cpp_method_call_expr | tooltip | `方法呼叫（回傳值）` | `對物件執行一個操作（方法），並取得結果` |

### 演算法類別（algorithms）

| ID | 欄位 | 目前 | 改為 |
|----|------|------|------|
| cpp_sort | message0 | `sort ( %1 , %2 ) ;` | `排序（ %1 到 %2 ）` |
| cpp_sort | tooltip | `排序` | `把指定範圍內的元素從小到大排好` |

### 物件導向類別（oop）

| ID | 欄位 | 目前 | 改為 |
|----|------|------|------|
| cpp_class_def | message0 | `class %1` | `定義類別 %1` |
| cpp_class_def | message1 | `public: %1` | `公開： %1` |
| cpp_class_def | message2 | `private: %1` | `私有： %1` |
| cpp_class_def | tooltip | `類別定義` | `定義一個類別，把資料和操作包裝在一起。公開的部分外面可以用，私有的只有內部能用` |
| cpp_new | message0 | `new %1 ( %2 )` | `建立新物件 %1（ %2 ）` |
| cpp_new | tooltip | `new 運算子` | `建立一個新的物件，並配置記憶體空間` |
| cpp_delete | message0 | `delete %1 ;` | `刪除物件 %1` |
| cpp_delete | tooltip | `delete 運算子` | `刪除用 new 建立的物件，歸還記憶體空間` |

### 樣板類別（templates）

| ID | 欄位 | 目前 | 改為 |
|----|------|------|------|
| cpp_template_function | message0 | `template < typename %1 >` | `樣板：讓 %1 代表任意型別` |
| cpp_template_function | tooltip | `樣板函式` | `建立一個樣板函式，可以處理不同型別的資料，不用重複寫很多版本` |

## Special 積木改動（special.json — 9 個）

| ID | 欄位 | 目前 | 改為 |
|----|------|------|------|
| c_raw_code | message0 | `code: %1` | `直接寫程式碼：%1` |
| c_raw_code | tooltip | `原始碼積木（未知語法降級用）` | `直接輸入程式碼，不經過積木轉換。用於積木無法表達的語法` |
| c_raw_expression | message0 | `expr: %1` | `直接寫運算式：%1` |
| c_raw_expression | tooltip | `原始碼運算式積木` | `直接輸入一個運算式，可以接到其他積木上` |
| c_include | message0 | `#include < %1 >` | `引入函式庫 %1` |
| c_include | tooltip | `#include 標頭檔` | `引入函式庫，讓程式可以使用裡面提供的功能` |
| c_include | HEADER dropdown | 原始標頭檔名 | 加上功能說明（見下表） |
| c_include_local | message0 | `#include " %1 "` | `引入自己的檔案 " %1 "` |
| c_include_local | tooltip | `#include 本地標頭檔` | `引入自己寫的標頭檔` |
| c_define | message0 | `#define %1 %2` | `定義常數 %1 為 %2` |
| c_define | tooltip | `#define 巨集定義` | `定義一個常數名稱，程式中用到這個名稱時會自動替換成設定的值` |
| c_ifdef | message0 | `#ifdef %1` + `#endif` | `如果有定義 %1 就執行` + `結束` |
| c_ifdef | tooltip | `#ifdef 條件編譯` | `如果這個名稱已經被定義過，就執行裡面的程式` |
| c_ifndef | message0 | `#ifndef %1` + `#endif` | `如果沒定義 %1 就執行` + `結束` |
| c_ifndef | tooltip | `#ifndef 條件編譯` | `如果這個名稱還沒被定義，就執行裡面的程式` |
| c_comment_line | message0 | `// %1` | `備註：%1` |
| c_comment_line | tooltip | `單行註解` | `寫一段備註說明，不會影響程式執行` |
| c_using_namespace | message0 | `using namespace %1 ;` | `使用命名空間 %1` |
| c_using_namespace | tooltip | `using namespace 宣告` | `讓這個命名空間裡的功能可以直接使用，不用加前綴。例如用 cout 代替 std::cout` |

### #include 下拉選單對照表

| Value | Label |
|-------|-------|
| stdio.h | stdio.h（C 標準輸入輸出） |
| stdlib.h | stdlib.h（C 標準函式庫） |
| string.h | string.h（C 文字處理） |
| math.h | math.h（數學函式） |
| stdbool.h | stdbool.h（布林型別） |
| iostream | iostream（輸入輸出） |
| vector | vector（動態列表） |
| string | string（文字處理） |
| algorithm | algorithm（演算法） |
| map | map（對照表） |
| set | set（集合） |
| stack | stack（堆疊） |
| queue | queue（佇列） |
| cmath | cmath（C++ 數學函式） |
| cstring | cstring（C++ 文字處理） |
| climits | climits（整數範圍常數） |

## 動態積木改動（blockly-editor.ts — 5 個）

需要在 TypeScript 原始碼中修改的動態積木：

| ID | 欄位 | 改動內容 |
|----|------|----------|
| u_print | tooltip | 確認為白話（目前已是「輸出一個或多個值到螢幕上」） |
| u_func_def | RETURN_TYPE dropdown | 套用型別下拉標準對照表 |
| u_func_def | tooltip | 改為白話說明（同 JSON 版本） |
| u_var_declare | TYPE dropdown | 套用型別下拉標準對照表 |
| u_var_declare | tooltip | 改為白話說明（同 JSON 版本） |
| u_var_ref | tooltip | 確認為白話 |
| u_input (u_input_multi) | message | 加入「變數」身份標示 |
