# `v9-savedstate.json`——改名前的真實存檔（回歸樣本）

**錄於**：2026-08-11，`spec 116` 的 T004。**在任何改名之前**——改完就錄不到了。

## 怎麼錄的

`npm run dev` → 瀏覽器 → 貼下面這段 C++ 進程式碼面板（⇄ 自動同步產生積木）
→ 執行 → 動一下積木觸發自動存檔 → `localStorage['semorphe-state']`。

課程是預設的**「初學 C++」**，這是刻意的：那個課程的可見集合不含 `vector`，
所以樣本**同時走過降級那條路**（顯示成 `int v;`）。

```cpp
#include <iostream>
#include <vector>
#include <stack>
using namespace std;
int main() {
int n = 0;
vector<int> v;
v.push_back(3);
v.push_back(4);
n = v[0] + v[1];
if (n > 5) {
cout << "big " << n << endl;
} else {
cout << "small" << endl;
}
for (int i = 0; i < 2; i = i + 1) {
cout << v[i] << endl;
}
stack<int> st;
st.push(7);
cout << st.top() << endl;
return 0;
}
```

## 執行輸出（改名前，瀏覽器實測）

```
big 7
3
4
7
```

## 積木型別（17 種）——**四種情況全部涵蓋**

| 情況 | 樣本裡的 |
|---|---|
| **`container_kind` 形態** | `c_stack_push` |
| **`role=expression` 形態** | `c_var_declare_expr` |
| **化石詞彙** | `cpp_stack_top`（`top` 是命名整理換掉的詞，`peek` 才在表上）、`c_container_push_back`、`c_for_loop`、`u_number`、`u_array_access` |
| **只差前綴** | `u_if`／`u_print`／`u_compare`／`u_arithmetic`／`u_var_declare`／`u_var_assign`／`u_var_ref`／`u_string`／`u_endl`／`c_raw_expression` |

完整清單：

```
c_container_push_back  c_for_loop        c_raw_expression   c_stack_push
c_var_declare_expr     cpp_stack_top     u_arithmetic       u_array_access
u_compare              u_endl            u_if               u_number
u_print                u_string          u_var_assign       u_var_declare
u_var_ref
```

## ⚠️ 錄這份樣本時掀出一個活的缺陷

匯出的檔案自稱 **`version: 1`**，而 localStorage 裡是 **9**。

根因：`src/ui/app.ts` 的 `buildSaveState()` 寫死 `version: 1`。
自動存檔沒事——`storage.save()` 會強制蓋成 `CURRENT_VERSION`。
**而匯出繞過 `save()`**，所以每一份匯出的 `.json` 都自稱 v1。

> **一個欄位有兩個寫入點，其中一個是對的，症狀就只在另一條路上出現。**

實測那八次多餘的升級在現有資料上是**冪等的**（樹逐字未變），所以今天沒有在壞
——**而那是巧合不是保證**：116 正要加一個會改寫積木狀態的 v10 步驟。

已修（`version: CURRENT_VERSION`）。本檔的 `version` 欄位是照 localStorage 的真實值 9
填回去的，其餘位元組與匯出檔相同。
