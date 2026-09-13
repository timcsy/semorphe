# 概念探索：C++ — `<cstring>`

## 摘要
- 語言：C++
- 目標：`<cstring>` 標頭檔（C 風格字串操作函式）
- 發現概念總數：10（教育價值篩選後）
- 通用概念：0、語言特定概念：10
- 已實作概念：3（cpp_strlen、cpp_strcmp、cpp_strcpy）
- 新增概念：7

## 現有實作狀態

| 概念 | blocks.json | generator | lifter | executor | 測試 |
|------|------------|-----------|--------|----------|------|
| cpp_strlen | ✅ | ✅ | ✅ | ✅ | 部分 |
| cpp_strcmp | ✅ | ✅ | ✅ | ✅ | 部分 |
| cpp_strcpy | ✅ | ✅ | ✅ | ✅(noop) | 部分 |

## 概念目錄

### 字串操作 — 基礎（depth 1）

已有概念直接保留，新增以下概念：

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| `cpp_strlen` | `strlen(s)` | 取得 C 字串長度 | 1 expr | lang-library | 特定 | `func_call_expr` | **已實作** |
| `cpp_strcmp` | `strcmp(s1, s2)` | 比較兩個 C 字串 | 2 expr | lang-library | 特定 | `func_call_expr` | **已實作** |
| `cpp_strcpy` | `strcpy(dest, src)` | 複製字串到目的地 | 2 expr | lang-library | 特定 | `func_call_expr` | **已實作** |
| `cpp_strcat` | `strcat(dest, src)` | 串接字串到目的地尾端 | 2 expr | lang-library | 特定 | `func_call_expr` | **新增** |
| `cpp_strncpy` | `strncpy(dest, src, n)` | 複製最多 n 個字元 | 2 expr + 1 expr(n) | lang-library | 特定 | `func_call_expr` | **新增** |
| `cpp_strncmp` | `strncmp(s1, s2, n)` | 比較最多 n 個字元 | 2 expr + 1 expr(n) | lang-library | 特定 | `func_call_expr` | **新增** |

### 字串搜尋 — 中級（depth 2）

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| `cpp_strchr` | `strchr(s, c)` | 在字串中搜尋字元 | 1 expr + 1 expr(char) | lang-library | 特定 | `func_call_expr` | **新增** |
| `cpp_strstr` | `strstr(s1, s2)` | 在字串中搜尋子字串 | 2 expr | lang-library | 特定 | `func_call_expr` | **新增** |

### 記憶體操作 — 進階（depth 2+）

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| `cpp_memset` | `memset(ptr, val, n)` | 將記憶體區塊填入指定值 | 1 expr + 1 expr(val) + 1 expr(n) | lang-library | 特定 | `func_call_expr` | **新增** |
| `cpp_memcpy` | `memcpy(dest, src, n)` | 複製記憶體區塊 | 3 expr | lang-library | 特定 | `func_call_expr` | **新增** |

### 排除的函式（教育價值不足）

| 函式 | 原因 |
|------|------|
| `memmove` | 與 memcpy 幾乎相同，overlapping 記憶體場景在教育中罕見 |
| `strncat` | strcat 已足夠，n 版本增加認知負載但教育收益低 |
| `strcoll` / `strxfrm` | locale 相關，初學者不會用到 |
| `strspn` / `strcspn` / `strpbrk` | 用途太小眾，教育場景罕見 |
| `strtok` | 狀態性（使用 static 變數），概念模型複雜且易出錯，不適合積木化 |
| `memchr` | 與 strchr 重疊，指標語義在積木中難以表達 |
| `strerror` | 錯誤處理，超出基本教育範圍 |
| `strrchr` | strchr 的反向版本，教育中罕見 |

## 依賴關係圖

```
cpp_strlen ← 無依賴（基礎）
cpp_strcmp ← 無依賴（基礎）
cpp_strcpy ← 需要理解 char 陣列
cpp_strcat ← 需要理解 char 陣列 + strcpy 概念
cpp_strncpy ← 依賴 strcpy，加上 n 參數
cpp_strncmp ← 依賴 strcmp，加上 n 參數
cpp_strchr ← 需要理解指標/字元
cpp_strstr ← 需要理解指標/子字串
cpp_memset ← 需要理解指標和記憶體
cpp_memcpy ← 需要理解指標和記憶體
```

## 建議實作順序

1. `cpp_strcat`（與 strcpy 同級，僅新增串接語義）
2. `cpp_strncpy`（strcpy 的 n 版本）
3. `cpp_strncmp`（strcmp 的 n 版本）
4. `cpp_strchr`（字串搜尋）
5. `cpp_strstr`（子字串搜尋）
6. `cpp_memset`（記憶體填充）
7. `cpp_memcpy`（記憶體複製）

## 跨語言對應

| cstring 函式 | C++ `<string>` 等價 | Python | 備註 |
|-------------|---------------------|--------|------|
| strlen | str.length() / str.size() | len(s) | 已有 cpp_string_length |
| strcmp | str1 == str2 | s1 == s2 | 直接比較 |
| strcpy | str = other | s = other | 賦值 |
| strcat | str += other / str.append() | s + other | 已有 cpp_string_append |
| strchr | str.find(c) | s.find(c) | 已有 cpp_string_find |
| strstr | str.find(sub) | s.find(sub) | 已有 cpp_string_find |
| memset | std::fill | N/A | 已有 cpp_fill |
| memcpy | std::copy | N/A | 無直接等價 |

## 需注意的邊界案例

1. **緩衝區溢位**：strcpy/strcat 不檢查目的地大小，這是 C 風格字串最大的安全風險
2. **strncpy 不保證 null 結尾**：如果 src 長度 >= n，dest 不會有 '\0'
3. **strcmp 回傳值**：回傳 0 表示相等（非 true），初學者常搞混
4. **strchr/strstr 回傳指標**：在積木中需要簡化為「是否找到」或「位置」
5. **memset 的 int 參數**：雖然接受 int，實際只用到低 8 位元（unsigned char）
6. **C 風格 vs C++ 風格**：現代 C++ 教學偏好 `<string>`，`<cstring>` 主要用於競賽和系統程式

## 概念屬性結構

### cpp_strcat
- **properties**: 無
- **children**: `dest` (expression), `src` (expression)
- **role**: statement

### cpp_strncpy
- **properties**: 無
- **children**: `dest` (expression), `src` (expression), `n` (expression)
- **role**: statement

### cpp_strncmp
- **properties**: 無
- **children**: `s1` (expression), `s2` (expression), `n` (expression)
- **role**: expression

### cpp_strchr
- **properties**: 無
- **children**: `str` (expression), `ch` (expression)
- **role**: expression

### cpp_strstr
- **properties**: 無
- **children**: `haystack` (expression), `needle` (expression)
- **role**: expression

### cpp_memset
- **properties**: 無
- **children**: `ptr` (expression), `value` (expression), `size` (expression)
- **role**: statement

### cpp_memcpy
- **properties**: 無
- **children**: `dest` (expression), `src` (expression), `size` (expression)
- **role**: statement
