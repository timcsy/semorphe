# 概念探索：C++ — `<cstdlib>`

## 摘要
- 語言：C++
- 目標：`<cstdlib>` 標準庫標頭檔
- 發現概念總數：6
- 通用概念：0、語言特定概念：6
- 建議歸屬的 Topic 層級樹節點：L1a（4 個）、L2a（2 個）

## 研究來源
- cppreference.com `<cstdlib>` 標頭檔參考

## 概念目錄

### L1a: 陣列與排序 — 中級（4 個概念）

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| cpp_rand | `rand()` | 產生偽隨機整數 | 0 | lang-library | 特定 | `func_call_expr` | 無參數，回傳 expression |
| cpp_srand | `srand(seed)` | 設定隨機數種子 | seed (expression) | lang-library | 特定 | `func_call` | statement |
| cpp_abs | `abs(value)` | 整數絕對值 | value (expression) | lang-library | 特定 | `func_call_expr` | ⚠️ 與 cmath abs 衝突（見備註） |
| cpp_exit | `exit(code)` | 正常終止程式 | code (expression) | lang-library | 特定 | `func_call` | statement |

### L2a: STL 容器 — 進階（2 個新概念）

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| cpp_atoi | `atoi(str)` | 字串轉整數 | str (expression) | lang-library | 特定 | `func_call_expr` | 競程常用，`const char*` 參數 |
| cpp_atof | `atof(str)` | 字串轉浮點數 | str (expression) | lang-library | 特定 | `func_call_expr` | 與 atoi 對稱 |

## 排除的函式（教育價值不足）

| 函式 | 排除原因 |
|---|---|
| malloc/calloc/realloc/free | C++ 教學中用 new/delete 取代，已有 cpp_new/cpp_delete |
| system() | 安全風險，不適合教學 |
| getenv() | 進階系統程式設計，超出範疇 |
| atol/atoll | atoi 已足夠，long/long long 版本差異僅在型別 |
| strtol/strtod 系列 | 需要 endptr 參數，對初學者太複雜 |
| div/ldiv/lldiv | 可用 `/` 和 `%` 運算子取代 |
| qsort/bsearch | C++ 中用 std::sort/std::lower_bound 取代，已有概念 |
| 多位元組字元函式 | 超出教學範疇 |
| abort() | exit() 已足夠 |

## 依賴關係圖

```
cpp_rand ← cpp_srand（通常一起使用）
cpp_abs ← (獨立)
cpp_exit ← (獨立)
cpp_atoi ← cpp_string_c_str（常搭配 .c_str() 使用）
cpp_atof ← cpp_string_c_str
```

## 建議實作順序

1. cpp_rand（最簡單，0 個輸入）
2. cpp_srand（與 rand 搭配）
3. cpp_abs（需處理 cmath 衝突）
4. cpp_exit（獨立）
5. cpp_atoi（新概念）
6. cpp_atof（與 atoi 對稱）

## 已存在的實作狀態

| 概念 | concepts.json | blocks.json | generator | lifter (io.ts) | executor |
|---|---|---|---|---|---|
| cpp_rand | ✅ | ✅ (codeTemplate) | ❌ 空 stub | ✅ L236 | ✅ L66 |
| cpp_srand | ✅ | ✅ (codeTemplate) | ❌ 空 stub | ✅ L239 | ✅ L68 |
| cpp_abs | ✅ | ✅ (codeTemplate) | ❌ 空 stub | ✅ L243 | ✅ L70 |
| cpp_exit | ✅ | ✅ (codeTemplate) | ❌ 空 stub | ✅ L247 | ✅ L72 |
| cpp_atoi | ❌ | ❌ | ❌ | ❌ | ❌ |
| cpp_atof | ❌ | ❌ | ❌ | ❌ | ❌ |

## 需注意的邊界案例

### abs() 優先權衝突
`tryCmathLift`（io.ts:193）在 cstdlib handler（io.ts:243）之前執行。cmath 的 `UNARY_FUNCS` 包含 `'abs'`，導致 `abs()` 被提升為 `cpp:math_unary` 而非 `cpp_abs`。

**解決方案**：從 cmath 的 `UNARY_FUNCS` 中移除 `'abs'`，讓 cstdlib 的 `cpp_abs` 處理整數版本。或者，接受 cmath 處理所有 abs() 呼叫，移除 cstdlib 的 abs lifter。

### atoi/atof 的 const char* 參數
`atoi()` 和 `atof()` 接受 `const char*`，在 C++ 中常搭配 `.c_str()` 使用。lift 時需識別 `atoi(s.c_str())` 這類模式。

## 跨語言對應

| C++ 概念 | 等價功能 |
|---|---|
| cpp_rand | Python random.randint、Java Math.random |
| cpp_abs | Python abs()、Java Math.abs() — 可考慮未來升級為通用概念 |
| cpp_exit | Python sys.exit()、Java System.exit() |
| cpp_atoi | Python int()、Java Integer.parseInt() |
