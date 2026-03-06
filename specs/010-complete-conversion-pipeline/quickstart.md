# 快速驗證場景：補齊轉換管線（完全重寫版）

## 場景 1：P3 驗證 — 純 JSON 積木雙向轉換

**驗證目標**: 證明新積木只需 JSON 就能完成四方向轉換

**操作步驟**:
1. 在 `advanced.json` 中確認 `c_increment` 有完整五維定義（concept + blockDef + codeTemplate + astPattern + renderMapping）
2. 確認**沒有**任何手寫 TypeScript 處理 `c_increment`
3. 拖曳 `c_increment` 積木 → 應產生 `i++`
4. 輸入程式碼 `i++` → 應還原為 `c_increment` 積木

**預期結果**: 純 JSON 定義的積木完成雙向轉換

## 場景 2：chain pattern — cout 鏈

**驗證目標**: lift-patterns.json 中的 chain pattern 正確處理 cout

**操作步驟**:
1. 拖曳 `u_print` 積木，加入多個值和 endl
2. 積木→程式碼 → `cout << x << y << endl;`
3. 程式碼→積木 → 還原為 `u_print`（不是 raw_code）

**預期結果**: chain pattern 走訪左遞迴 `binary_expression` 鏈，正確辨識為 `print` 概念

## 場景 3：composite pattern — 計數 for 迴圈

**驗證目標**: lift-patterns.json 中的 composite pattern 正確偵測計數模式

**操作步驟**:
1. 拖曳 `u_count_loop` 積木（i from 0 to 10）
2. 積木→程式碼 → `for (int i = 0; i < 10; i++) { ... }`
3. 程式碼→積木 → 還原為 `u_count_loop`

**預期結果**: composite pattern 檢查 init/cond/update 三部分，確認符合計數模式

## 場景 4：operatorDispatch — 二元運算

**驗證目標**: 同一 AST nodeType 根據運算子分派到不同概念

**操作步驟**:
1. 輸入 `x + 5` → 應產生 `u_arithmetic` 積木
2. 輸入 `x > 5` → 應產生 `u_compare` 積木
3. 輸入 `x && y` → 應產生 `u_logic` 積木

**預期結果**: 三個都是 `binary_expression` 但映射到不同概念

## 場景 5：L2 積木全覆蓋

**驗證目標**: advanced.json 中 27 個積木全部來回轉換正確

**操作步驟**:
1. 對每個 L2 積木（指標、結構體、STL、OOP）執行來回轉換
2. 驗證每個都還原為正確的積木類型

**預期結果**: 27/27 積木來回轉換成功，零退化為 raw_code

## 場景 6：手寫程式碼導入

**操作步驟**:
1. 在程式碼編輯器輸入：
```cpp
#include <iostream>
#include <vector>
using namespace std;
int main() {
    vector<int> v;
    for (int i = 0; i < 5; i++) {
        v.push_back(i * 2);
    }
    int sum = 0;
    for (int i = 0; i < v.size(); i++) {
        sum += v[i];
    }
    cout << sum << endl;
    return 0;
}
```
2. 程式碼→積木

**預期結果**:
- `#include` → `c_include` 積木
- `using namespace` → `c_using_namespace` 積木
- `int main()` → `u_func_def` 積木
- `vector<int> v` → `cpp_vector_declare` 積木
- `for(int i=0; i<5; i++)` → `u_count_loop` 積木
- `v.push_back(i*2)` → `cpp_vector_push_back` 或 `cpp_method_call` 積木
- `sum += v[i]` → `c_compound_assign` 積木
- `cout << sum << endl` → `u_print` 積木
- `return 0` → `u_return` 積木

## 場景 7：降級保證（P1 有損保留）

**操作步驟**:
1. 輸入不支援的 C++ 構造：`auto x = [](int a) { return a * 2; };`
2. 程式碼→積木

**預期結果**: 產生 `c_raw_code` 積木，完整保留原始程式碼文字，不當機
