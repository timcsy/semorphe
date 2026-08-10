# T001：改名前的基準（2026-08-11 實測）

量法：`allCppProjections()`（宣告的唯一組裝點）逐顆比
`blockDef.type` 與 `deriveBlockType(conceptId, form)`。

```
專案宣告的積木          186
  已符合                 33
  只差前綴               67    cpp:address_of → c_address_of
  主體不同（化石）        86    cpp:stack_peek → cpp_stack_top
                        ───
  不符合計              153
```

## ⚠️ 兩個數字都對，量的不是同一件事

`draft` 記的 86 是「**主體不同**」；本規格收的 153 是「**嚴格導出**」。
`186 = 33 + 67 + 86`。

## 非中性形態（11 個）——改名前後對照

| 身分 | 今天 | 導出後 |
|---|---|---|
| `cpp:func_call` | `u_func_call_expr` | `cpp_func_call_expression` |
| `cpp:input` | `u_input_expr` | `cpp_input_expression` |
| `cpp:increment` | `c_increment_expr` | `cpp_increment_expression` |
| `cpp:var_assign_compound` | `c_compound_assign_expr` | `cpp_var_assign_compound_expression` |
| `cpp:var_declare` | `c_var_declare_expr` | `cpp_var_declare_expression` |
| `cpp:method_call` | `cpp_method_call_expr` | `cpp_method_call_expression` |
| `cpp:input_formatted` | `c_scanf_expr` | `cpp_input_formatted_expression` |
| `cpp:container_push` | `c_stack_push`／`c_queue_push` | `cpp_container_push_stack`／`_queue` |
| `cpp:container_pop` | `c_stack_pop`／`c_queue_pop` | `cpp_container_pop_stack`／`_queue` |

⚠️ **11 個全部要改** —— research 二原本以為 7 個可以保留，那是錯的
（`_expr` 是 `expression` 的縮寫，不是 `form.value`）。訂正見 research.md。

## 護欄第一次跑（T003）

```
✓ 自我否證：掃到 186 顆 ≥ 150
✓ 導出名唯一
✗ 不符數 = 0        ← **紅的，報 153 筆，逐項指名**
✓ 注入①②③④
```
