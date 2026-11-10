# 模糊測試報告：C++ friend（2026-11-10，元件管線 389）

- 出題：隔離的出題者 4 支，1 支原稿編不過（`audit` 寫 `Auditor` 的私有欄位卻沒宣告成朋友），補一行原型後保留。
- 全部 PASS：lift → 產碼 → 再 lift 同一棵，產生碼 g++ 編譯後輸出與原稿相同。
- SEMANTIC_DIFF 0、COMPILE_FAIL 0、ROUNDTRIP_DRIFT 0、WRONG_COMPONENT 0。it.todo 0。

## 覆蓋缺口（照實降級或翻不出，不是缺陷）

| 程式 | 構造 | 現況 |
|---|---|---|
| fuzz_2 | `friend ostream& operator<<(ostream&, const T&)` | 是元件；Cella 那一路翻不出（型別 ostream 沒有對應） |
| fuzz_3 | 另一個類別的成員當朋友、類別裡帶本體的朋友函式 | 原文 |
| fuzz_4 | 命名空間限定名的朋友 | 原文 |
| fuzz_4 | 成員初始化列多引數 `a(size, vector<int>(size, 0))` | 原文（既有缺口） |

Cella 對 fuzz_1 原稿判 unknown：`size_t` 只 include 了 iostream／vector／string，標準不保證宣告它。判決正確。
