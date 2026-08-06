# Feature Specification: 兩個 `pointer_declarator` 沒下鑽的 bug

**Feature Branch**: `084-pointer-declarator-nesting` ｜ **Created**: 2026-08-06

## 為什麼做這個

`cpp_pointer_declare` 是第二大的阻斷者（10 支 todo）。查了之後，**四個裡兩個
是真的、兩個過期**——與陣列初始化列表那批（全部過期）不同。

| 阻斷者 | 實測 |
|---|---|
| 回傳指標的函式 | ✅ 真的：`int* f(int* p)` 產出 **`int f(int* p)()`** |
| 指標陣列 | ✅ 真的：`int* a[3];` 產出 **`int* ptr;`** |
| for 迴圈裡宣告指標 | ❌ 過期，早就正確 |
| `const char*` 參數 | ❌ 過期，早就正確 |

## 兩個真 bug 的根因是同一種

**語法樹的 `pointer_declarator` 包了一層，而辨識器沒有下鑽。**

- 函式：`declarator` 欄位取到的是 `pointer_declarator`，裡面才是函式宣告子
  ——於是整個 `f(int* p)` 被當成名字
- 陣列：`pointer_declarator` 裡包的是 `array_declarator` 不是 `identifier`
  ——於是名字取不到，落到預設值

## ⚠️ 第二個特別危險

`int* a[3];` 產出 `int* ptr;`——**那看起來像一段合法程式**。編譯得過、跑得動，
只是不是使用者寫的那一段。

**只驗來回轉換抓不到它**（產出的是合法 C++），要驗**執行結果**才會現形。

## Requirements

- **FR-001**: 回傳指標的函式 MUST 保住星號，且 MUST NOT 多出括號
- **FR-002**: 雙星號 MUST 也對——只驗單星的話 `char**` 會靜靜掉一顆
- **FR-003**: 指標陣列 MUST 保住名字與大小
- **FR-004**: 一般函式／陣列／指標 MUST NOT 被影響
- **FR-005**: 每一支 MUST 驗執行結果，期望值 MUST 由**真的編譯器**決定
- **FR-006**: 解鎖的 todo MUST 移除或重新產生，**MUST NOT 留下空的 describe**

## Success Criteria

- **SC-001**: 只有名字的測試 **58 → 50**
- **SC-002**: 兩個 bug 各有正反測試
- **SC-003**: 既有測試全數通過

## 順帶：移掉 todo 之後留下兩個空的 describe

那兩個 describe 裡有現成的程式碼，只有一句 `// BUG: …` 註解，沒有任何斷言。

**一個空的 describe 是殼**——它看起來覆蓋了一個情形，實際上零斷言。
兩個都填成真的測試（來回轉換 + 執行結果），而不是刪掉。
