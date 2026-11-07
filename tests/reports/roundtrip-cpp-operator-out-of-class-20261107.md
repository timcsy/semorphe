# Round-Trip 測試報告 — C++ 運算子的原型與類別外定義（第 331 刀）— 2026-11-07

走 `cpp:method_declare`／`cpp:method_def_outside`，名字記成 `operator⊕`（決定見 `specs/component-discovery/cpp-operator-out-of-class.md`）。期望輸出是 clang++ 跑出來的。

| # | 程式 | 結果 | 細節 |
|---|---|---|---|
| op_1 | 矩陣乘法、指派、相等 | ✅ PASS | 元件身分、一字不差、不漂移、Cella 輸出同 clang（兩種風格） |
| op_2 | `<<` 串接（回傳 `*this` 參照）、const 的 `[]` | ✅ PASS | 同上 |
| op_3 | 給 `sort` 用的 `<` | ✅ PASS | 同上 |
| 盲測 fuzz_6 | Stack 的 `<<`、RPN | ✅ PASS | 修了指標陣列參數之後 Cella accept、輸出同 clang |
| 盲測 fuzz_2 | Matrix 乘法與指派、自管記憶體 | 🟡 Cella unknown（ubElide） | 修了 `delete[]` 之後判得出；Cella 照實說輸出取決於具名回傳值的複製省略（實作相依）——印出的與 clang 相同 |
| 盲測 fuzz_8 | Fraction | 🟡 DEGRADED | `static int gcd(int, int);` 靜態成員函式的原型——draft 裡另一列的既有缺口，不在這一刀 |

## 順手抓到並修掉的既有缺陷（三個，兩個是對稱的資料遺失）

1. **`delete[] p` 的 `[]`**：lift 不記、產碼不寫、formalize 一律 `arr: false` ⟹ 來回比對一直綠、Cella 照實判 ubFree。`cpp:delete` 加 `is_array`（積木多一格「物件／陣列」）；存檔 v27 用新的 `addedFields` 作廢舊快取
2. **指標的陣列當參數（`const char* t[]`）**：`[]` 丟了，型別變 `const char*`，`t[i][0]` 被判「不是陣列或指標」、產回去也少 `[]`。lift 補上；參數串產碼併成一份（一般函式那條原本自己有一份 `[]` 的規則，建構子與方法那支沒有）
3. **`F a(1, 2), b(1, 3);`**：一行宣告好幾個類別物件、各帶建構子引數——外層沒有 `init_style`，逐一翻宣告子時不經過類別的直接初始化 ⟹ Cella 判找不到建構子

## 永久測試
- `tests/integration/roundtrip-cpp-out-of-class-member.test.ts`（追加 op_1～3 ＋ 兩個回歸）
- `src/components/cpp/method_declare/spec.test.ts`（運算子四支）、`src/components/cpp/delete/spec.test.ts`（新）、`src/components/cpp/var_declare/spec.test.ts`（新）
- `tests/integration/fuzz-cpp-oop-out-of-class.test.ts`（fuzz_2 容許誠實的 unknown 並斷言輸出同 clang）
