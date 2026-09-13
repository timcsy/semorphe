# 概念探索：C++ — `<cctype>`

## 摘要
- 語言：C++
- 目標：`<cctype>` 標準庫標頭檔
- 發現概念總數：4（全部已存在）
- 通用概念：0、語言特定概念：4
- 建議歸屬的 Topic 層級樹節點：L1b（4 個）

## 概念目錄

### L1b: 進階控制流 — 中級（4 個概念）

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| cpp_isalpha | `isalpha(ch)` | 檢查是否為英文字母 | value (expression) | lang-library | 特定 | `func_call_expr` | 回傳 int (nonzero=true) |
| cpp_isdigit | `isdigit(ch)` | 檢查是否為數字字元 | value (expression) | lang-library | 特定 | `func_call_expr` | |
| cpp_toupper | `toupper(ch)` | 轉換為大寫 | value (expression) | lang-library | 特定 | `func_call_expr` | 回傳 int |
| cpp_tolower | `tolower(ch)` | 轉換為小寫 | value (expression) | lang-library | 特定 | `func_call_expr` | 回傳 int |

## 排除的函式

| 函式 | 排除原因 |
|---|---|
| isalnum | isalpha + isdigit 的組合，教育價值不足以獨立積木 |
| isspace, ispunct, isprint | 進階用途，初學者極少使用 |
| isupper, islower | 教育價值低，可用 toupper/tolower 間接判斷 |
| isxdigit, iscntrl | 超出教學範疇 |

## 已存在的實作狀態

| 概念 | concepts.json | blocks.json | generator | lifter (io.ts) | executor |
|---|---|---|---|---|---|
| cpp_isalpha | ✅ | ✅ (codeTemplate) | ❌ 空 stub | ✅ L253 | ✅ L77-78 |
| cpp_isdigit | ✅ | ✅ (codeTemplate) | ❌ 空 stub | ✅ L254 | ✅ L77-79 |
| cpp_toupper | ✅ | ✅ (codeTemplate) | ❌ 空 stub | ✅ L255 | ✅ L77-80 |
| cpp_tolower | ✅ | ✅ (codeTemplate) | ❌ 空 stub | ✅ L256 | ✅ L77-81 |

## 需要的工作
1. 寫 hand-written generators（取代 codeTemplate）
2. 移除 blocks.json 中的 codeTemplate
3. 建立 roundtrip 測試
