# 概念探索：C++ — `<utility>`

## 摘要
- 語言：C++
- 目標：`<utility>` 標頭檔
- 發現概念總數：2（已存在）
- 通用概念：0、語言特定概念：2
- 建議歸屬的 Topic 層級樹節點：L3a（STL 容器操作）2 個

## 概念目錄

### L3a: STL 容器操作 — 進階

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| `cpp_pair_declare` | `pair<T1,T2> name;` | 宣告一個 pair 變數 | TYPE1 (dropdown), TYPE2 (dropdown), NAME (field) | lang-library | 特定 | `var_declare` | **已存在**，需移除 codeTemplate |
| `cpp_make_pair` | `make_pair(a, b)` | 建立一個 pair 值 | FIRST (expr), SECOND (expr) | lang-library | 特定 | `func_call` | **已存在**，需移除 codeTemplate |

## 排除的概念
- `swap` — 已在 `<algorithm>` 模組實作
- `move` / `forward` — 太進階（右值引用語義）
- `declval` — 模板元程式設計，不適合教育

## 建議實作順序
1. `cpp_pair_declare`（移除 codeTemplate，修正 generator）
2. `cpp_make_pair`（移除 codeTemplate，修正 generator）
