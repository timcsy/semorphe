# 概念探索：C++ — `<cstdio>`

## 摘要
- 語言：C++
- 目標：`<cstdio>` 標頭檔
- 發現概念總數：3（全部已實作）
- 新增概念：0
- 語言特定概念：3（cpp_printf, cpp_scanf, cpp_scanf_expr）

## 現有概念清單

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 狀態 |
|---|---|---|---|---|---|
| cpp_printf | `printf("%d\n", x)` | 格式化輸出到 stdout | FORMAT, ARGS | lang-library | ✅ 完整 |
| cpp_scanf | `scanf("%d", &x)` | 格式化輸入從 stdin | FORMAT, ARGS | lang-library | ✅ 完整 |
| cpp_scanf_expr | `scanf("%d", &x)` | scanf 的表達式形式 | FORMAT, ARGS | lang-library | ✅ 完整 |

## 產出物完整性

| 產出物 | cpp_printf | cpp_scanf | cpp_scanf_expr |
|--------|-----------|-----------|----------------|
| BlockSpec | ✅ | ✅ | ✅ |
| Generator | ✅ 手寫 | ✅ 手寫 | ✅ 手寫 |
| Lifter | ✅ extractPrintf | ✅ extractScanf | ✅ 共用 |
| Executor | ✅ io.ts | ✅ io.ts | ✅ io.ts |
| i18n | ✅ | ✅ | ✅ |
| Topic | ✅ beginner L1b, competitive L0 | ✅ | ✅ |

## 不納入的函式

以下 `<cstdio>` 函式不適合教育場景，不建議建立概念：
- `fprintf`, `fscanf` — 檔案 I/O，需理解 FILE* 指標
- `fopen`, `fclose` — 檔案操作，教育場景用 `<fstream>` 更合適
- `sprintf`, `snprintf` — 格式化到字串，教育場景用 `to_string` + 串接
- `sscanf` — 從字串解析，教育場景用 `stoi`/`stod`
- `fgets`, `fputs` — C 風格字串 I/O，教育場景用 `getline`/`cout`
- `putchar`, `getchar` — 單字元 I/O，太低階

## 缺口

唯一的缺口是**缺少 roundtrip 測試**。需要為 cpp_printf 和 cpp_scanf 建立
`tests/integration/roundtrip-cpp-cstdio.test.ts`。

## 建議實作順序
1. 建立 roundtrip 測試（概念已完整實作，只缺測試覆蓋）
