# 概念探索：C++ — `<string>`

## 摘要
- 語言：C++
- 目標：`<string>` 標頭檔（`std::string` 類別及相關自由函式）
- 發現概念總數：16
- 通用概念：0
- 語言特定概念：16
- 建議歸屬的 Topic 層級樹節點：L2a（陣列與字串）13 個、L3a（STL 容器操作）3 個

## 資料來源
- [cppreference: `<string>` header](https://en.cppreference.com/w/cpp/header/string.html)
- [GeeksforGeeks: C++ String Functions](https://www.geeksforgeeks.org/cpp/cpp-string-functions/)
- [W3Schools: C++ String Reference](https://www.w3schools.com/cpp/cpp_ref_string.asp)

## 概念目錄

### L2a: 陣列與字串 — 中級

以下概念屬於 `<string>` 模組，放在 `src/languages/cpp/std/string/`。

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 狀態 |
|---|---|---|---|---|---|---|---|
| `cpp_string_declare` | `string s;` | 宣告 string 變數 | NAME | lang-core | 特定 | `var_declare` | ✅ 已有 |
| `cpp_string_length` | `s.length()` | 取得字串長度 | OBJ | lang-library | 特定 | `func_call` | ✅ 已有 |
| `cpp_string_substr` | `s.substr(pos, len)` | 提取子字串 | OBJ, POS, LEN | lang-library | 特定 | `func_call` | ✅ 已有 |
| `cpp_string_find` | `s.find("x")` | 搜尋子字串位置 | OBJ, ARG | lang-library | 特定 | `func_call` | ✅ 已有 |
| `cpp_string_append` | `s.append("x")` | 附加字串 | OBJ, VALUE | lang-library | 特定 | `func_call` | ✅ 已有 |
| `cpp_string_c_str` | `s.c_str()` | 轉換為 C 字串 | OBJ | lang-library | 特定 | `func_call` | ✅ 已有 |
| `cpp_getline` | `getline(cin, s)` | 讀取整行輸入 | NAME | lang-library | 特定 | `func_call` | ✅ 已有 |
| `cpp_to_string` | `to_string(n)` | 數值轉字串 | VALUE | lang-library | 特定 | `func_call` | ✅ 已有 |
| `cpp_stoi` | `stoi(s)` | 字串轉整數 | VALUE | lang-library | 特定 | `func_call` | ✅ 已有 |
| `cpp_stod` | `stod(s)` | 字串轉浮點數 | VALUE | lang-library | 特定 | `func_call` | ✅ 已有 |
| `cpp_string_empty` | `s.empty()` | 檢查字串是否為空 | OBJ | lang-library | 特定 | `func_call` | ⬜ 新增 |
| `cpp_string_erase` | `s.erase(pos, len)` | 刪除子字串 | OBJ, POS, LEN | lang-library | 特定 | `func_call` | ⬜ 新增 |
| `cpp_string_insert` | `s.insert(pos, "x")` | 在指定位置插入 | OBJ, POS, VALUE | lang-library | 特定 | `func_call` | ⬜ 新增 |

### L3a: STL 容器操作 — 進階

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 狀態 |
|---|---|---|---|---|---|---|---|
| `cpp_string_replace` | `s.replace(pos, n, "x")` | 替換子字串 | OBJ, POS, LEN, VALUE | lang-library | 特定 | `func_call` | ⬜ 新增 |
| `cpp_string_push_back` | `s.push_back('c')` | 附加單一字元 | OBJ, CHAR | lang-library | 特定 | `func_call` | ⬜ 新增 |
| `cpp_string_clear` | `s.clear()` | 清空字串 | OBJ | lang-library | 特定 | `func_call` | ⬜ 新增 |

### 不納入的函式（理由）

| 函式 | 理由 |
|---|---|
| `s.size()` | 與 `s.length()` 完全相同，不需重複概念 |
| `s[i]` | 已由通用 `array_access` 概念處理 |
| `s + t` | 已由通用 `arithmetic` 概念（+ 運算子）處理 |
| `s == t` | 已由通用 `compare` 概念處理 |
| `s.at(i)` | 教育上與 `s[i]` 太相似，bounds checking 是進階主題 |
| `s.compare()` | 教育上 `==`/`<`/`>` 運算子更直觀，compare() 回傳 int 增加認知負載 |
| `s.front()` / `s.back()` | 可用 `s[0]` / `s[s.length()-1]` 表達 |
| `s.pop_back()` | 使用頻率低，可用 `s.erase(s.length()-1, 1)` 表達 |
| `s.assign()` | 與 `=` 運算子語義相同 |
| `s.copy()` | C 風格操作，不推薦在教育中使用 |
| `s.data()` | 與 `c_str()` 幾乎相同 |
| `s.rfind()` / `find_first_of()` 等 | 進階搜尋，認知負載高，使用頻率低 |
| `stol()` / `stoll()` / `stof()` | 與 `stoi()`/`stod()` 模式相同，不需要獨立積木 |
| `starts_with()` / `ends_with()` | C++20 特性，非標準教學範圍 |

## 依賴關係圖

```
cpp_string_declare (基礎，無依賴)
  ├── cpp_string_length (需要宣告的 string)
  ├── cpp_string_substr (需要 string + 位置)
  ├── cpp_string_find (需要 string)
  ├── cpp_string_append (需要 string)
  ├── cpp_string_c_str (需要 string)
  ├── cpp_string_empty (需要 string)
  ├── cpp_string_erase (需要 string + 位置)
  ├── cpp_string_insert (需要 string + 位置)
  ├── cpp_string_replace (需要 string + 位置 + 長度)
  ├── cpp_string_push_back (需要 string)
  └── cpp_string_clear (需要 string)
cpp_getline (需要 iostream + string)
cpp_to_string (獨立)
cpp_stoi / cpp_stod (需要 string)
```

## 建議實作順序

已有概念（需驗證、重做）：
1. cpp_string_declare
2. cpp_string_length
3. cpp_string_find
4. cpp_string_append
5. cpp_string_substr
6. cpp_string_c_str
7. cpp_getline
8. cpp_to_string
9. cpp_stoi
10. cpp_stod

新增概念：
11. cpp_string_empty（最常用，特別是競賽）
12. cpp_string_erase（字串操作基本功）
13. cpp_string_insert（字串操作基本功）
14. cpp_string_replace（進階操作）
15. cpp_string_push_back（競賽常用）
16. cpp_string_clear（基本容器操作）

## 跨語言對應

| C++ 概念 | Python 等價 | Java 等價 |
|---|---|---|
| cpp_string_length | `len(s)` | `s.length()` |
| cpp_string_find | `s.find("x")` | `s.indexOf("x")` |
| cpp_string_substr | `s[a:b]` | `s.substring(a, b)` |
| cpp_string_append | `s += "x"` | `sb.append("x")` |
| cpp_string_empty | `not s` / `len(s) == 0` | `s.isEmpty()` |
| cpp_stoi | `int(s)` | `Integer.parseInt(s)` |
| cpp_to_string | `str(n)` | `String.valueOf(n)` |

這些操作在多個語言中存在等價概念，但語法差異太大，保持為語言特定概念。

## 需注意的邊界案例

1. **`string::npos`**：`find()` 找不到時回傳 `string::npos`（`-1` 作為 `size_t`），初學者常與 `-1` 比較
2. **`substr` 範圍**：`substr(pos, len)` 中 `len` 是長度而非結束位置（Python 的 slice 是結束位置）
3. **`erase` vs `substr`**：`erase` 是原地修改，`substr` 回傳新字串
4. **`stoi` 例外**：輸入非數字時拋出 `std::invalid_argument`
5. **`string` 宣告**：`string s;` 的 tree-sitter AST 與 `int x;` 相同（`declaration`），lifter 以 type="string" 區分
6. **方法呼叫 lift**：`s.length()`、`s.find()` 等需要 lifter 從 `call_expression` + `field_expression` 模式中正確識別
