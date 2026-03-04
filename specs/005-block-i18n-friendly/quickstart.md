# Quickstart: 積木文字全面中文化驗證

**Date**: 2026-03-04

## 驗證場景

### 場景 1: Universal 積木中文化驗證

1. 開啟應用程式
2. 逐一從工具箱拖出所有 universal 積木
3. 檢查每個積木的 message 文字是否為中文
4. hover 每個積木檢查 tooltip 是否為白話說明
5. 打開型別下拉選單檢查是否有中文說明（如 `int（整數）`）
6. 確認 u_var_assign 顯示「把**變數**…」
7. 確認 u_func_call 顯示「呼叫**函式**…」
8. 確認 u_array_access 顯示「**陣列**…的第…格」
9. 確認 u_input 顯示「讀取輸入 → **變數**…」

### 場景 2: Basic/Special 積木中文化驗證

1. 切換到進階模式
2. 拖出 c_switch 積木，確認顯示「根據…的值」
3. 拖出 c_for_loop，確認顯示「自訂重複：初始…；條件…；更新…」
4. 拖出 c_include，打開下拉選單確認有功能說明
5. 拖出 c_comment_line，確認顯示「備註：…」

### 場景 3: Advanced 積木中文化驗證

1. 切換到進階模式
2. 拖出 c_pointer_declare，確認顯示「建立 int（整數）指標變數…」
3. 拖出 cpp_vector_declare，確認顯示「建立 int（整數）列表變數…」
4. 拖出 cpp_stack_declare，hover 確認 tooltip 提到「後進先出」
5. 拖出 cpp_queue_declare，hover 確認 tooltip 提到「先進先出」

### 場景 4: Round-trip 驗證

1. 在程式碼編輯器輸入一段包含多種語法的 C++ 程式
2. 點擊「程式碼→積木」轉換
3. 確認積木正確生成且文字為中文
4. 點擊「積木→程式碼」轉換
5. 確認生成的程式碼與原始程式碼一致

### 場景 5: 向後相容驗證

1. 在改動前的版本建立一些積木並存檔
2. 升級到改動後的版本
3. 重新載入頁面
4. 確認舊版 workspace 能正確載入
5. 確認積木顯示新的中文文字
