# 概念探索：C++ — std::string 字元索引存取（operator[]）

## 摘要
- 語言：C++
- 目標：std::string 的 `operator[]` — 以索引存取字元
- 發現概念總數：1
- 通用概念：0、語言特定概念：1
- 建議歸屬的 Topic 層級樹節點：L2a（陣列與字串）1 個概念

## 背景分析

### 為何需要專屬概念

現有的 `array_access`（`u_array_access` 積木）的 dropdown 只掃描 `u_array_declare` 積木，**無法選取字串變數**（`cpp_string_declare`）。因此，學生雖然可以對陣列做 `arr[i]`，但無法在積木端對字串做 `str[i]`。

`cpp_string_at` 提供專屬的字串字元存取積木，解決此覆蓋缺口。

### 與現有概念的關係

| 現有概念 | 對應語法 | 問題 |
|---|---|---|
| `array_access` | `arr[i]` | dropdown 不含字串變數 |
| `cpp_string_substr` | `str.substr(pos, len)` | 回傳子字串，非單一字元 |
| `cpp_string_find` | `str.find(s)` | 搜尋，非存取 |

`cpp_string_at` 語義：**讀取字串第 N 個字元**，回傳 `char`。

## 概念目錄

### L2a（陣列與字串）— 進階基礎

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 |
|---|---|---|---|---|---|---|
| `cpp_string_at` | `str[i]` | 取得字串第 i 個字元（char） | OBJ（dropdown：字串變數）、INDEX（Expression） | lang-library | 語言特定 | `array_access` |

## 屬性定義

| 欄位 | 型別 | 說明 |
|---|---|---|
| `obj` | string | 字串變數名稱（由 dropdown 選取） |

## 子節點定義

| 欄位 | 角色 | 說明 |
|---|---|---|
| `index` | Expression | 索引值（0-based） |

## 積木設計

```
[ 取得字串 <str▼> 第 [ <index> ] 個字元 ]
```

- `OBJ`：`field_dropdown`，動態列出工作區中所有 `cpp_string_declare` 的變數名
- `INDEX`：`input_value`（Expression）
- role：expression，output: Expression
- 顏色：字串 category 色

## i18n 標籤規劃

| Key | zh-TW | en |
|---|---|---|
| `CPP_STRING_AT_MSG0` | `取得字串 %1 第 %2 個字元` | `Get character at index %2 of string %1` |
| `CPP_STRING_AT_TOOLTIP` | `取得字串指定位置的字元（0 起始索引）` | `Get the character at the given index in the string (0-based)` |

## 程式碼產生

```
${obj}[${index}]
```

## Lift 策略

- tree-sitter 節點類型：`subscript_expression`
- 優先條件：物件（`object` 欄位）的文字在作用域中是 `cpp_string_declare` 的變數
- 若無法確認型別：降級到通用 `array_access`
- 信心等級：`warning`（subscript_expression 是一對多映射：字串/陣列/向量都用同一節點）

## Interpreter Executor

- 行為：取得 `obj` 字串的第 `index` 個字元，回傳 `char`（或 `{ type: 'string', value: char }`）
- 需要邊界檢查（index >= 0 && index < str.length）

## 依賴關係

- 前置：`cpp_string_declare`（需先有字串變數）
- 相關：`array_access`（通用降級）

## 建議實作順序

1. `cpp_string_at`（唯一概念，無內部依賴）

## 跨語言對應

| 語言 | 等價語法 | 備註 |
|---|---|---|
| Python | `s[i]` | 可通用化，但目前只做 C++ |
| Java | `s.charAt(i)` | 不同方法名 |

## 需注意的邊界案例

- 索引為負數（C++ 未定義行為）
- 索引超出長度（C++ 未定義行為）
- 字串是 `""` 空字串時存取（UB）
- lift 方向：`str[0]` 可能被誤認為 `array_access`（正確降級行為）
