# 概念探索：C++ — `<sstream>`

## 摘要
- 語言：C++
- 目標：`<sstream>` 標頭檔
- 發現概念總數：1（已存在）
- 通用概念：0、語言特定概念：1
- 建議歸屬的 Topic 層級樹節點：L3c（例外與進階）1 個

## 概念目錄

### L3c: 例外與進階

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| `cpp_stringstream_declare` | `stringstream ss;` | 宣告字串串流 | NAME (field) | lang-library | 特定 | `var_declare` | **已存在**，需移除 codeTemplate |

## 排除的概念
- `stringstream <<` / `>>` — 使用現有 `print` / `input` 概念的方法呼叫 pattern 處理
- `ss.str()` — 使用 `cpp_method_call_expr` 處理
