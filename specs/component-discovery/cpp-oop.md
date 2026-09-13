# 概念探索：C++ — OOP（物件導向程式設計）

## 摘要
- 語言：C++
- 目標：struct, class, constructor, destructor, virtual, override, operator overload, inheritance, static member, reference
- 發現概念總數：15
- 通用概念：0、語言特定概念：15
- 建議歸屬的 Topic 層級樹節點：L2c（基礎 OOP）6 個、L3b（進階 OOP）9 個

## 現有狀態

以下概念在 `concepts.json` 和 `blocks.json` 中**已定義**，但部分缺少 generator 或 executor：

| 概念 | concepts.json | blocks.json | Lifter | Generator | Executor |
|------|:---:|:---:|:---:|:---:|:---:|
| cpp_struct_declare | ✅ | ✅ | ✅ (astPattern) | ❌ | ❌ |
| cpp_struct_member_access | ✅ | ✅ | ✅ | ❌ | ❌ |
| cpp_struct_pointer_access | ✅ | ✅ | ✅ | ❌ | ❌ |
| cpp_class_def | ✅ | ✅ | ✅ (strategy) | ✅ | ❌ |
| cpp_constructor | ✅ | ✅ | ✅ (strategy) | ✅ | ❌ |
| cpp_destructor | ✅ | ✅ | ✅ (strategy) | ✅ | ❌ |
| cpp_virtual_method | ✅ | ✅ | ✅ (strategy) | ✅ | ❌ |
| cpp_pure_virtual | ✅ | ✅ | ✅ (strategy) | ✅ | ❌ |
| cpp_override_method | ✅ | ✅ | ✅ (strategy) | ✅ | ❌ |
| cpp_operator_overload | ✅ | ✅ | ✅ (strategy) | ✅ | ❌ |
| cpp_static_member | ✅ | ✅ | ✅ (strategy) | ✅ | ✅ |
| cpp_method_call | ✅ | ✅ | ✅ | ❌ | ❌ |
| cpp_method_call_expr | ✅ | ✅ | ✅ | ❌ | ❌ |

以下概念**完全不存在**：

| 概念 | 說明 |
|------|------|
| cpp_inheritance | 類別繼承 `: public Base` |
| cpp_reference_declare | 引用宣告 `int& ref = x` |

## 概念目錄

### L2c: 結構與類別 — 基礎

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 狀態 |
|---|---|---|---|---|---|---|---|
| `cpp_struct_declare` | `struct Point { int x; int y; };` | 定義結構型別 | NAME, MEMBERS (statement_input) | lang-core | 特定 | raw_code | 缺 generator/executor |
| `cpp_struct_member_access` | `p.x` | 存取結構成員 | OBJ, MEMBER | lang-core | 特定 | raw_code | 缺 generator/executor |
| `cpp_struct_pointer_access` | `ptr->x` | 透過指標存取成員 | PTR, MEMBER | lang-core | 特定 | raw_code | 缺 generator/executor |
| `cpp_class_def` | `class Dog { public: ... private: ... };` | 定義類別 | NAME, public/private bodies | lang-core | 特定 | raw_code | 缺 executor |
| `cpp_method_call` | `obj.method(args)` | 呼叫物件方法（語句） | OBJ, METHOD, ARGS | lang-core | 特定 | func_call | 缺 generator/executor |
| `cpp_method_call_expr` | `obj.method(args)` | 呼叫物件方法（表達式） | OBJ, METHOD, ARGS | lang-core | 特定 | func_call | 缺 generator/executor |

### L3b: OOP 進階

| 概念名稱 | 語法 | 語義意義 | 積木輸入 | Layer | 通用/特定 | 降級路徑 | 狀態 |
|---|---|---|---|---|---|---|---|
| `cpp_constructor` | `Dog(string n) : name(n) {}` | 建構函式（含初始化列表） | CLASS, PARAMS, INIT_LIST, BODY | lang-core | 特定 | func_def | 缺 executor |
| `cpp_destructor` | `~Dog() {}` | 解構函式 | CLASS, BODY | lang-core | 特定 | func_def | 缺 executor |
| `cpp_virtual_method` | `virtual void speak() {}` | 虛擬方法 | RETURN_TYPE, NAME, PARAMS, BODY | lang-core | 特定 | func_def | 缺 executor |
| `cpp_pure_virtual` | `virtual void speak() = 0;` | 純虛擬方法 | RETURN_TYPE, NAME, PARAMS | lang-core | 特定 | func_def | 缺 executor |
| `cpp_override_method` | `void speak() override {}` | 覆寫方法 | RETURN_TYPE, NAME, PARAMS, BODY | lang-core | 特定 | func_def | 缺 executor |
| `cpp_operator_overload` | `Point operator+(const Point& other) {}` | 運算子多載 | RETURN_TYPE, OP, PARAMS, BODY | lang-core | 特定 | func_def | 缺 executor |
| `cpp_static_member` | `static int count;` | 靜態成員宣告 | TYPE, NAME | lang-core | 特定 | var_declare | ✅ 完整 |
| `cpp_inheritance` | `class Dog : public Animal {}` | 類別繼承 | CLASS, BASE, ACCESS | lang-core | 特定 | raw_code | **全新** |
| `cpp_reference_declare` | `int& ref = x;` | 引用宣告 | TYPE, NAME, INITIALIZER | lang-core | 特定 | var_declare | **全新** |

## 依賴關係圖

```
cpp_struct_declare ──► cpp_struct_member_access
                   └──► cpp_struct_pointer_access (需要 pointer)
cpp_class_def ──► cpp_constructor
              ├──► cpp_destructor
              ├──► cpp_virtual_method
              ├──► cpp_pure_virtual
              ├──► cpp_override_method
              ├──► cpp_operator_overload
              ├──► cpp_static_member
              └──► cpp_method_call / cpp_method_call_expr
cpp_inheritance ──► cpp_virtual_method, cpp_override_method
cpp_reference_declare（獨立）
```

## 建議實作順序

1. `cpp_struct_declare` — 補 generator + executor
2. `cpp_struct_member_access` — 補 generator + executor
3. `cpp_struct_pointer_access` — 補 generator + executor
4. `cpp_method_call` / `cpp_method_call_expr` — 補 generator + executor
5. `cpp_class_def` — 補 executor
6. `cpp_constructor` — 補 executor
7. `cpp_destructor` — 補 executor
8. `cpp_inheritance` — 全新（概念定義 + blocks.json + lifter + generator + executor）
9. `cpp_reference_declare` — 全新
10. `cpp_virtual_method` — 補 executor
11. `cpp_pure_virtual` — 補 executor
12. `cpp_override_method` — 補 executor
13. `cpp_operator_overload` — 補 executor
14. `cpp_static_member` — ✅ 已完整

## 需注意的邊界案例

1. **struct vs class**：tree-sitter 分別使用 `struct_specifier` 和 `class_specifier`，但語義幾乎相同（預設存取權限不同）
2. **struct 定義位置**：struct 可以在全域、函式內部、或類別內部定義
3. **成員存取 vs 方法呼叫**：`obj.member` vs `obj.method()` 在 tree-sitter 中都是 `field_expression`，差異在是否包裹在 `call_expression` 中
4. **operator<< 多載**：`cout << obj` 常需要 `operator<<` 多載，但這個模式很複雜，可能降級為 raw_code
5. **繼承鏈**：多重繼承（`class D : public B1, public B2`）在 APCS 範圍中罕見，可以先只支援單一繼承
6. **引用 vs 指標**：`int& ref` 的 tree-sitter AST 結構與指標類似（`reference_declarator`）
7. **const 引用參數**：`const int&` 在函式參數中很常見，lifter 需要正確處理
