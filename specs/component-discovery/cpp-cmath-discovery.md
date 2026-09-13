# 概念探索：C++ — `<cmath>`

## 摘要

- 語言：C++
- 目標：`<cmath>` 標頭檔（數學函式）
- 發現概念總數：3（以積木型態計）
- 涵蓋函式總數：25+
- 通用概念：0、語言特定概念：3
- Layer：全部為 `lang-library`
- 建議歸屬的 Topic 層級樹節點：L1a（基礎數學）2 個、L2c（進階數學）1 個

## 設計決策：下拉選單 vs 獨立積木

### 分析

`<cmath>` 的函式有一個關鍵特徵：**幾乎全部是 1-arg 或 2-arg 的純函式，積木形狀完全相同**。若每個函式一個積木（如 cstring 模組的做法），工具箱會出現 20+ 個形狀一模一樣的積木，嚴重增加認知負載。

### 建議：分組下拉選單（類似 `arithmetic` 的 `operator` 屬性）

參考先例：
- `arithmetic` 概念用 `operator` 屬性選擇 +, -, *, /, %
- Blockly 內建的 `math_single` 和 `math_trig` 也使用下拉選單

**三個概念涵蓋所有函式：**

| 概念 | 形狀 | 函式數 | 說明 |
|------|------|--------|------|
| `cpp:math_unary` | dropdown + 1 input → 1 output | 17 | 單參數數學函式 |
| `cpp:math_pow` | 2 inputs → 1 output | 1 | pow 獨立積木（最常用，有語義化標籤 base/exponent） |
| `cpp:math_binary` | dropdown + 2 inputs → 1 output | 5 | 雙參數數學函式 |

## 概念目錄

### L1a: 函式與迴圈 — 基礎數學

#### `cpp:math_unary` — 單參數數學函式

| 屬性 | 說明 |
|------|------|
| **conceptId** | `cpp:math_unary` |
| **layer** | `lang-library` |
| **role** | `expression` |
| **properties** | `func`（下拉選單值） |
| **children** | `value`（expression） |
| **降級路徑** | D1 → D2 `func_call_expr` → D3 `raw_code` |
| **四路完備性** | lift: func name → func property; render: dropdown + input; extract: from dropdown + child; generate: `func(value)` |

**`func` 下拉選單選項（按教育優先排序）：**

| 選項值 | 顯示標籤 | 語法 | 教育等級 | 語義意義 |
|--------|----------|------|----------|----------|
| `abs` | abs（絕對值） | `abs(x)` | 基礎 | 取絕對值 |
| `sqrt` | √（平方根） | `sqrt(x)` | 基礎 | 取平方根 |
| `ceil` | ⌈x⌉（無條件進位） | `ceil(x)` | 基礎 | 向上取整 |
| `floor` | ⌊x⌋（無條件捨去） | `floor(x)` | 基礎 | 向下取整 |
| `round` | 四捨五入 | `round(x)` | 基礎 | 四捨五入到整數 |
| `sin` | sin | `sin(x)` | 中級 | 正弦（弧度） |
| `cos` | cos | `cos(x)` | 中級 | 餘弦（弧度） |
| `tan` | tan | `tan(x)` | 中級 | 正切（弧度） |
| `asin` | asin | `asin(x)` | 中級 | 反正弦 |
| `acos` | acos | `acos(x)` | 中級 | 反餘弦 |
| `atan` | atan | `atan(x)` | 中級 | 反正切 |
| `exp` | e^x | `exp(x)` | 中級 | 自然指數 |
| `log` | ln（自然對數） | `log(x)` | 中級 | 自然對數 |
| `log2` | log₂ | `log2(x)` | 中級 | 以 2 為底的對數 |
| `log10` | log₁₀ | `log10(x)` | 中級 | 以 10 為底的對數 |
| `trunc` | 截斷小數 | `trunc(x)` | 中級 | 向零取整 |
| `cbrt` | ∛（立方根） | `cbrt(x)` | 進階 | 取立方根 |

**常見模式：**
```cpp
double r = sqrt(x * x + y * y);     // 距離計算
int n = ceil(total / (double)size);  // 向上整除
double angle = atan(slope);          // 角度計算
int digits = floor(log10(n)) + 1;   // 數字位數
```

**先備知識：** 變數、算術運算、函式呼叫概念
**錯誤模式：** 三角函式忘記轉弧度、`sqrt` 傳入負數、`log` 傳入 0 或負數

---

#### `cpp:math_pow` — 次方

| 屬性 | 說明 |
|------|------|
| **conceptId** | `cpp:math_pow` |
| **layer** | `lang-library` |
| **role** | `expression` |
| **properties** | （無） |
| **children** | `base`（expression）、`exponent`（expression） |
| **降級路徑** | D1 → D2 `func_call_expr` → D3 `raw_code` |
| **四路完備性** | lift: match pow() call; render: base/exponent inputs; extract: from children; generate: `pow(base, exponent)` |

**積木設計：** `%1 的 %2 次方`（base ^ exponent）

**語法：** `pow(base, exponent)`

**常見模式：**
```cpp
double area = pow(r, 2) * M_PI;     // 圓面積
double cube = pow(x, 3);            // 立方
double root = pow(x, 1.0 / n);     // n 次方根
```

**先備知識：** 算術運算
**錯誤模式：** `pow(2, 32)` 精度問題（應用整數型態）、整數次方效率不如迴圈

**為何獨立積木：** pow 是最常用的 2-arg 數學函式，`base` 和 `exponent` 的語義標籤比通用的 `arg1`/`arg2` 更直覺。

---

### L2c: 結構與容器 — 進階數學

#### `cpp:math_binary` — 雙參數數學函式

| 屬性 | 說明 |
|------|------|
| **conceptId** | `cpp:math_binary` |
| **layer** | `lang-library` |
| **role** | `expression` |
| **properties** | `func`（下拉選單值） |
| **children** | `arg1`（expression）、`arg2`（expression） |
| **降級路徑** | D1 → D2 `func_call_expr` → D3 `raw_code` |
| **四路完備性** | lift: func name → func property; render: dropdown + 2 inputs; extract: from dropdown + children; generate: `func(arg1, arg2)` |

**`func` 下拉選單選項：**

| 選項值 | 顯示標籤 | 語法 | 語義意義 |
|--------|----------|------|----------|
| `fmod` | 浮點餘數 | `fmod(x, y)` | x 除以 y 的浮點餘數 |
| `hypot` | 斜邊長 | `hypot(x, y)` | √(x² + y²) |
| `atan2` | atan2 | `atan2(y, x)` | 計算向量(x,y)的角度 |
| `fmin` | 浮點最小值 | `fmin(x, y)` | 兩浮點數取小 |
| `fmax` | 浮點最大值 | `fmax(x, y)` | 兩浮點數取大 |

**常見模式：**
```cpp
double dist = hypot(dx, dy);         // 距離
double angle = atan2(dy, dx);        // 角度
double remainder = fmod(time, 360);  // 循環
```

**先備知識：** 基礎數學函式、浮點數概念
**錯誤模式：** `atan2` 的參數順序是 (y, x) 而非 (x, y)

---

## 依賴關係圖

```
func_call_expr (universal, 已存在)
   ↑ D2 fallback
   │
   ├── cpp:math_unary  (無內部依賴)
   ├── cpp:math_pow    (無內部依賴)
   └── cpp:math_binary (無內部依賴)

全部概念共同依賴：
  - cpp_include (#include <cmath>)
  - var_declare / var_assign (儲存結果)
  - arithmetic (常作為引數)
```

## 建議實作順序

1. **`cpp:math_pow`** — 最簡單（無下拉選單），最常用，適合作為 cmath 模組的第一個概念
2. **`cpp:math_unary`** — 涵蓋最多函式，下拉選單機制可作為模板
3. **`cpp:math_binary`** — 最後實作，使用情境較進階

## Topic 層級樹整合建議

### cpp-beginner.json

在 `L1a: 函式與迴圈` 加入：
```json
"cpp:math_pow", "cpp:math_unary"
```

在 `L2c: 結構與容器`（或新建 `L2d: 進階數學`）加入：
```json
"cpp:math_binary"
```

### cpp-competitive.json

在 `L1a: 陣列與排序` 加入：
```json
"cpp:math_pow", "cpp:math_unary"
```

在 `L2a: STL 容器` 加入：
```json
"cpp:math_binary"
```

## 工具箱分類建議

新增 `math` registryCategory，或放入現有 `algorithms` 類別。建議新增：

```typescript
{
  key: 'cpp_math', nameKey: 'CATEGORY_CPP_MATH', fallback: '數學函式', colorKey: 'cpp_math',
  registryCategories: ['math'],
}
```

## Lift Pattern 設計要點

### 關鍵挑戰：多函式 → 單概念的 lift

所有 cmath 函式在 AST 中都是 `call_expression`，需要根據 function name 文字路由到正確概念並設定 `func` 屬性。

**建議方案：** 使用 `liftStrategy` 配合 JSON pattern

```json
{
  "id": "cpp_math_unary",
  "astNodeType": "call_expression",
  "patternType": "composite",
  "liftStrategy": "cpp:mathUnaryLift",
  "priority": 3
}
```

`mathUnaryLift` strategy：
1. 檢查 function name 是否在已知清單中（abs, sqrt, sin, ...）
2. 建立 SemanticNode，`func` = function name，`value` = lift(arguments[0])
3. 不在清單中 → 回傳 null，交給 `func_call_expr` fallback

### 生成器設計

code template 無法使用（因為 func 是動態的），需要 NodeGenerator：

```typescript
g.set('cpp:math_unary', (node, ctx) => {
  const func = node.properties.func as string
  const value = generateExpression(node.children.value[0], ctx)
  return `${func}(${value})`
})
```

## 跨語言對應

| cmath 函式 | Python 等價 | Java 等價 | 未來通用概念潛力 |
|-----------|-------------|-----------|-----------------|
| abs/fabs | `abs()` | `Math.abs()` | `math_abs` |
| sqrt | `math.sqrt()` | `Math.sqrt()` | `math_sqrt` |
| pow | `math.pow()` / `**` | `Math.pow()` | `math_pow` |
| sin/cos/tan | `math.sin()` | `Math.sin()` | `math_trig` |
| ceil/floor/round | `math.ceil()` | `Math.ceil()` | `math_round` |
| log/log2/log10 | `math.log()` | `Math.log()` | `math_log` |

**未來可升級為通用概念**：當新增第二個語言（如 Python）時，`math_unary` / `math_pow` / `math_binary` 可升級為 universal 概念。目前先作為 `lang-library` 實作。

## 需注意的邊界案例

1. **`abs` 的多義性**：C++ 的 `abs` 在 `<cstdlib>`（整數版）和 `<cmath>`（浮點版）都有。lift 時需要根據上下文判斷。建議統一歸入 `cpp:math_unary`，生成時用 `abs()`，header 用 `<cmath>`。
2. **`M_PI` 常數**：`M_PI` 不是 `<cmath>` 標準保證的，但很常用。可以作為 `builtin_constant` 的擴充（另一個概念探索議題）。
3. **整數 vs 浮點**：學生常寫 `pow(2, 10)` 期待得到整數 1024，但 `pow` 回傳 `double`。積木提示應警告此行為。
4. **三角函式的弧度**：初學者常忘記 sin/cos/tan 接受弧度而非角度。積木 tooltip 應明確提示。
5. **`atan2(y, x)` 參數順序**：y 在前、x 在後，與直覺相反。積木標籤應明確標示。
6. **鏈式呼叫**：`sqrt(pow(x, 2) + pow(y, 2))` — 數學函式常嵌套使用，積木的 expression 插槽天然支援。
