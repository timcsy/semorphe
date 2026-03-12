# 概念探索：C++ — 物件導向程式設計（OOP）

## 摘要
- 語言：C++
- 目標：struct definition, class definition (public/private/protected), constructor, destructor, virtual function, override, operator overloading, inheritance (base class), static member, reference parameter, member access (dot/arrow operator)
- 發現概念總數：14
- 通用概念：0
- 語言特定概念：14（cpp_struct_declare, cpp_struct_member_access, cpp_struct_pointer_access, cpp_class_def, cpp_constructor, cpp_destructor, cpp_virtual_method, cpp_pure_virtual, cpp_override_method, cpp_operator_overload, cpp_static_member, cpp_method_call, cpp_method_call_expr, cpp_ref_declare）
- 尚未存在的概念：2（cpp_inheritance — 繼承/基底類別；class_def 缺少 protected 區段）
- 建議歸屬的 Topic 層級樹節點：L2c（結構 3 個）、L3（OOP 核心 10 個）、L2（reference 1 個）

## 概念目錄

### 結構定義與成員存取

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| cpp_struct_declare | `struct Point { int x; int y; };` | 定義一個結構體，包含成員變數 | name(field_input), members(statement_input) | lang-core | 特定 | raw_code | 已存在。積木 id = `c_struct_declare`，codeTemplate = `struct ${NAME} { ${MEMBERS} };`。astPattern 使用 `struct_specifier` |
| cpp_struct_member_access | `obj.field` | 以點運算子存取結構成員（表達式） | obj(field_input), member(field_input) | lang-core | 特定 | raw_expression | 已存在。積木 id = `c_struct_member_access`，codeTemplate = `${OBJ}.${MEMBER}`。astPattern 使用 `field_expression` + operator=`.` |
| cpp_struct_pointer_access | `ptr->field` | 以箭頭運算子存取指標結構成員（表達式） | ptr(field_input), member(field_input) | lang-core | 特定 | raw_expression | 已存在。積木 id = `c_struct_pointer_access`，codeTemplate = `${PTR}->${MEMBER}`。astPattern 使用 `field_expression` + operator=`->` |

### 類別定義

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| cpp_class_def | `class MyClass { public: ... private: ... };` | 定義一個類別，包含 public 和 private 區段 | name(field_input), public(statement_input), private(statement_input) | lang-core | 特定 | raw_code | 已存在。積木 id = `cpp_class_def`，category = `oop`。lift-pattern 使用 liftStrategy `cpp:liftClassDef`（解析 access_specifier）。**注意：不支援 `protected` 區段** |

### 建構子與解構子

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| cpp_constructor | `MyClass(int x) : val(x) { ... }` | 類別建構子，支援初始化列表 | class_name(field_input), params(field_input), init_list(field_input), body(statement_input) | lang-core | 特定 | raw_code | 已存在。積木 id = `c_constructor`，category = `oop`。Lifter 在 `liftClassMember` 中辨識（declarator name == className）。**注意：params 使用 field_input（自由文字），非結構化參數** |
| cpp_destructor | `~MyClass() { ... }` | 類別解構子 | class_name(field_input), body(statement_input) | lang-core | 特定 | raw_code | 已存在。積木 id = `c_destructor`，category = `oop`。Lifter 在 `liftClassMember` 中辨識（declarator type == `destructor_name`） |

### 虛擬函式與多型

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| cpp_virtual_method | `virtual void method() { ... }` | 可被衍生類別覆寫的虛擬方法 | return_type(field_input), name(field_input), params(field_input), body(statement_input) | lang-core | 特定 | func_def | 已存在。積木 id = `c_virtual_method`，category = `oop`。Lifter 在 `liftClassMember` 中辨識（isVirtual && hasBody && !hasOverride） |
| cpp_pure_virtual | `virtual void method() = 0;` | 純虛擬方法（抽象），衍生類別必須實作 | return_type(field_input), name(field_input), params(field_input) | lang-core | 特定 | raw_code | 已存在。積木 id = `c_pure_virtual`，category = `oop`，codeTemplate = `virtual ${RETURN_TYPE} ${NAME}(${PARAMS}) = 0;`。Lifter 辨識 field_declaration + isVirtual + default_value=`0` |
| cpp_override_method | `void method() override { ... }` | 覆寫基底類別的虛擬方法 | return_type(field_input), name(field_input), params(field_input), body(statement_input) | lang-core | 特定 | func_def | 已存在。積木 id = `c_override_method`，category = `oop`。Lifter 在 `liftClassMember` 中辨識（isVirtual && hasOverride）。Generator 輸出 `override` 關鍵字 |

### 運算子多載

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| cpp_operator_overload | `MyClass operator+(const MyClass& other) { ... }` | 自訂運算子行為 | return_type(field_input), operator(field_dropdown: +/-/*/==/<</>>/[]), param_type(field_input), param_name(field_input), body(statement_input) | lang-core | 特定 | raw_code | 已存在。積木 id = `c_operator_overload`，category = `oop`。Lifter 在 `liftClassMember` 中辨識（operator_name） |

### 靜態成員

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| cpp_static_member | `static int count;` | 類別的靜態成員變數宣告 | type(field_dropdown), name(field_input) | lang-core | 特定 | raw_code | 已存在。積木 id = `c_static_member`，category = `data`。Generator 在 `declarations.ts` 中（`static ${type} ${name};`）。Executor 為 noop |

### 引用參數

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| cpp_ref_declare | `int& ref = x;` | 宣告一個引用變數 | type(field_dropdown), name(field_input), initializer(value_input) | lang-core | 特定 | var_declare | 已存在。積木 id = `c_ref_declare`。Generator 在 `declarations.ts` 中。Lifter 在 `strategies.ts` 中辨識（declaration 含 `&` 修飾）。Executor 使用 `execVarDeclare`。**注意：這是引用變數宣告，非函式的引用參數。函式引用參數透過 func_def 的 params 自由文字達成** |

### 方法呼叫（成員函式呼叫）

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| cpp_method_call | `obj.push_back(val);` | 呼叫物件的成員函式（statement） | obj(field_input), method(field_input), args(field_input) | lang-core | 特定 | func_call | 已存在。積木 id = `cpp_method_call`，category = `containers`。使用 codeTemplate（`${OBJ}.${METHOD}(${ARGS});`）。astPattern 使用 `call_expression` + function.type=`field_expression` |
| cpp_method_call_expr | `obj.size()` | 呼叫物件的成員函式（expression） | obj(field_input), method(field_input), args(field_input) | lang-core | 特定 | func_call_expr | 已存在。積木 id = `cpp_method_call_expr`，category = `containers`。使用 codeTemplate（`${OBJ}.${METHOD}(${ARGS})`） |

### 尚未實作

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 備註 |
|---|---|---|---|---|---|---|---|
| cpp_inheritance | `class Derived : public Base { ... }` | 類別繼承（指定基底類別） | — | lang-core | 特定 | 手動在 class name 輸入 `Derived : public Base` | **不存在**。目前 `cpp_class_def` 沒有 base class 屬性。Lifter `cpp:liftClassDef` 不解析 `base_class_clause`。使用者可透過在 name 欄位手動輸入含繼承語法的字串來變通，但無結構化支援 |
| cpp_protected_section | `protected:` 區段 | 類別的 protected 存取區段 | — | lang-core | 特定 | 放在 public 區段中 | **不存在**。`cpp_class_def` 僅支援 public 和 private 兩個區段。Lifter 中 `currentAccess` 只判斷 `public` 與否，`protected` 成員會被歸入 private |

## 六構件完整性驗證

每個 OOP 概念需具備以下 6 項構件才算完整：
1. **Concept JSON**：`src/languages/cpp/core/concepts.json` 中的概念定義
2. **Block JSON**：`src/languages/cpp/core/blocks.json` 中的積木定義（blockDef + 可選 codeTemplate）
3. **Generator**：`src/languages/cpp/core/generators/*.ts` 中的程式碼生成函式，或 blocks.json 中的 codeTemplate
4. **Lifter**：`src/languages/cpp/lift-patterns.json` 或 `src/languages/cpp/core/lifters/strategies.ts` 中的 AST→語義提升規則
5. **Executor**：`src/interpreter/executors/*.ts` 或 `src/interpreter/interpreter.ts` 中的直譯器執行函式
6. **Lift Pattern / AST Pattern**：`lift-patterns.json` 中的 JSON 模式，或 blocks.json 中的 `astPattern`，或策略函式

### 完整性矩陣

| 概念 | Concept JSON | Block JSON | Generator | Lifter | Executor | AST Pattern | 狀態 |
|---|---|---|---|---|---|---|---|
| cpp_struct_declare | ✅ | ✅ `c_struct_declare` | ✅ codeTemplate | ✅ astPattern (struct_specifier) | ✅ noop (interpreter.ts) | ✅ blocks.json | **完整** |
| cpp_struct_member_access | ✅ | ✅ `c_struct_member_access` | ✅ codeTemplate | ✅ astPattern (field_expression, `.`) | ❌ 無 executor | ✅ blocks.json | **缺 Executor** |
| cpp_struct_pointer_access | ✅ | ✅ `c_struct_pointer_access` | ✅ codeTemplate | ✅ astPattern (field_expression, `->`) | ❌ 無 executor | ✅ blocks.json | **缺 Executor** |
| cpp_class_def | ✅ | ✅ `cpp_class_def` | ✅ statements.ts | ✅ `cpp:liftClassDef` | ✅ noop (interpreter.ts) | ✅ lift-patterns.json (class_specifier) | **完整** |
| cpp_constructor | ✅ | ✅ `c_constructor` | ✅ statements.ts | ✅ `liftClassMember` | ✅ noop (interpreter.ts) | ✅ 策略函式 | **完整** |
| cpp_destructor | ✅ | ✅ `c_destructor` | ✅ statements.ts | ✅ `liftClassMember` | ✅ noop (interpreter.ts) | ✅ 策略函式 | **完整** |
| cpp_virtual_method | ✅ | ✅ `c_virtual_method` | ✅ statements.ts | ✅ `liftClassMember` | ✅ noop (interpreter.ts) | ✅ 策略函式 | **完整** |
| cpp_pure_virtual | ✅ | ✅ `c_pure_virtual` | ✅ statements.ts + codeTemplate | ✅ `liftClassMember` | ✅ noop (interpreter.ts) | ✅ 策略函式 | **完整** |
| cpp_override_method | ✅ | ✅ `c_override_method` | ✅ statements.ts | ✅ `liftClassMember` | ✅ noop (interpreter.ts) | ✅ 策略函式 | **完整** |
| cpp_operator_overload | ✅ | ✅ `c_operator_overload` | ✅ statements.ts | ✅ `liftClassMember` | ✅ noop (interpreter.ts) | ✅ 策略函式 | **完整** |
| cpp_static_member | ✅ | ✅ `c_static_member` | ✅ declarations.ts | ❌ 無專屬 lifter | ✅ noop (variables.ts) | ❌ 無 AST pattern | **缺 Lifter/AST Pattern** |
| cpp_ref_declare | ✅ | ✅ `c_ref_declare` | ✅ declarations.ts | ✅ strategies.ts | ✅ variables.ts | ✅ 策略函式 | **完整** |
| cpp_method_call | ✅ | ✅ `cpp_method_call` | ✅ codeTemplate | ❌ 無專屬 lifter | ❌ 無 executor | ✅ blocks.json astPattern | **缺 Lifter + Executor** |
| cpp_method_call_expr | ✅ | ✅ `cpp_method_call_expr` | ✅ codeTemplate | ❌ 無專屬 lifter | ❌ 無 executor | ✅ blocks.json astPattern | **缺 Lifter + Executor** |

### 完整性摘要

- **完整（8/14）**：cpp_struct_declare, cpp_class_def, cpp_constructor, cpp_destructor, cpp_virtual_method, cpp_pure_virtual, cpp_override_method, cpp_operator_overload
- **部分完成（4/14）**：
  - `cpp_struct_member_access`：缺 Executor（表達式概念，直譯器無法求值）
  - `cpp_struct_pointer_access`：缺 Executor（表達式概念，直譯器無法求值）
  - `cpp_static_member`：缺 Lifter 和 AST Pattern（code→blocks 無法自動辨識）
  - `cpp_method_call` / `cpp_method_call_expr`：缺 Lifter 和 Executor
- **完全缺失（2 概念）**：
  - `cpp_inheritance`：繼承（base class）— 概念、積木、所有構件均不存在
  - `cpp_protected_section`：protected 存取區段 — 概念、積木均不存在（class_def 僅支援 public/private）

## 已知技術債與設計限制

1. **params 字串化**：`cpp_constructor`、`cpp_virtual_method`、`cpp_override_method` 的 params 在積木層使用 field_input（自由文字字串），而在語義層使用 `param_decl` 子節點。兩層的表達方式不一致。
2. **init_list 字串化**：`cpp_constructor` 的初始化列表為純字串（field_input），無法結構化表達 `member(value)` 對應關係。
3. **無繼承語法結構**：`cpp_class_def` 沒有 `base_class` 屬性，使用者無法透過積木表達 `class Derived : public Base`。Lifter 也不解析 `base_class_clause`。
4. **class_def 無 protected**：僅支援 public 和 private 兩個存取區段。Lifter 中遇到 `protected:` 時會將成員歸入 private。
5. **member access 無 Executor**：`cpp_struct_member_access` 和 `cpp_struct_pointer_access` 在直譯器中完全不支援，因為直譯器目前不模擬結構體/物件的記憶體模型。
6. **method_call 無 Lifter**：`cpp_method_call` / `cpp_method_call_expr` 在 blocks.json 有 astPattern，但 lift-patterns.json 和 strategies.ts 中沒有對應的 lifter，code→blocks 時可能依賴 `block-spec-registry` 的自動推導。
7. **OOP 概念全為 noop executor**：class_def、constructor、destructor、virtual_method、override_method、operator_overload 在直譯器中全部註冊為 noop，不實際執行任何 OOP 行為（無物件實例化、無虛擬表）。

## 依賴關係圖

```
var_declare ─────────────────┐
                             ▼
              cpp_struct_declare ──▶ cpp_struct_member_access   （obj.field）
                             │           │
                             │           ▼
                             ├──▶ cpp_struct_pointer_access     （ptr->field）
                             │
                             ▼
              cpp_class_def ──────────────────────────┐
                   │                                  │
                   ├──▶ cpp_constructor               ├──▶ cpp_static_member
                   │        （含 init_list）           │
                   ├──▶ cpp_destructor                ├──▶ cpp_method_call
                   │                                  │        （obj.method()）
                   ├──▶ cpp_virtual_method             │
                   │        │                         ├──▶ cpp_method_call_expr
                   │        ▼                         │
                   │   cpp_pure_virtual               │
                   │        │                         │
                   │        ▼                         │
                   ├──▶ cpp_override_method            │
                   │                                  │
                   └──▶ cpp_operator_overload          │
                                                      │
cpp_ref_declare ──────────────────────────────────────┘
       （引用變數宣告，func_def params 字串中的 & 參數）

❌ cpp_inheritance（不存在）
     class Derived : public Base { ... }
     └──▶ 需擴充 cpp_class_def 概念 + lifter

❌ cpp_protected_section（不存在）
     └──▶ 需擴充 cpp_class_def 積木 + lifter
```

## 建議優先處理順序

1. **P1 — cpp_inheritance**：繼承是 OOP 的核心概念，且 virtual/override 語義上依賴繼承。需要：
   - 擴充 `cpp_class_def` concept 增加 `base_class` 和 `access` 屬性
   - 擴充積木定義增加 base class 欄位
   - 擴充 generator 輸出 `: public Base`
   - 擴充 lifter 解析 `base_class_clause`

2. **P2 — cpp_protected_section**：三種存取控制（public/private/protected）是 C++ 類別的基本特性。需要：
   - 擴充 `cpp_class_def` 增加 `protected` children 區段
   - 擴充 generator 和 lifter

3. **P3 — Lifter 補全**：`cpp_static_member`、`cpp_method_call`、`cpp_method_call_expr` 缺少 lifter/AST pattern，code→blocks 轉換時可能無法正確辨識。

4. **P4 — Executor 補全**：`cpp_struct_member_access`、`cpp_struct_pointer_access`、`cpp_method_call`、`cpp_method_call_expr` 在直譯器中不可執行。這需要直譯器支援物件/結構體的記憶體模型，工程量較大。
