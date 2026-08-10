/**
 * 積木型別的改名表（v9 → v10，spec 116）
 *
 * ## 為什麼是**凍結的明表**，不是一條規則
 *
 * 規則很單純（`conceptId` 的 `:` 換 `_`，非中性形態接 `_` ＋ `form.value`），
 * 而「**v9 那時存在哪些積木型別**」是**歷史事實**。從當下的登錄表推導的話，
 * 往後每一次增刪元件都會悄悄改變這張表——而它要處理的是幾個月前存的檔案。
 *
 * 寫成明表讓每一筆都看得見：規則若對某一顆是錯的，讀的人指得出來。
 * （與 `id-migrations.ts` 同一個理由，同一個形狀。）
 *
 * ## ⚠️ 這是這個專案的第一次**積木狀態**遷移
 *
 * 既有的八個升級步驟**每一個都只改寫語義樹**（`raw.tree`）。
 * 積木狀態（`blocklyState`）從來沒有被碰過——因為身分是真實，而積木型別是投影。
 *
 * 那為什麼這次要碰？因為 `src/ui/app.ts` 載入時：
 *
 * ```ts
 * // 1. Restore blocks FIRST (before level change triggers resync)
 * this.blocklyPanel?.setState(state.blocklyState)
 * ```
 *
 * > **一個被存起來、而且載入時當作還原來源的投影，行為上就是真實。**
 *
 * 所以它適用 P8 的例外條款（「語義詞彙本身的變更 MUST 附一次性的轉換」），
 * 而不是「投影可重建所以不用管舊檔」。
 */

/**
 * 舊積木型別 → 新積木型別。
 *
 * ⚠️ **只加不改。** 這張表描述的是過去，過去不會變。
 */
export const BLOCK_TYPE_MIGRATIONS_V9_TO_V10: Record<string, string> = {
  c_address_of: 'cpp_address_of',
  c_array_2d_access: 'cpp_array_2d_at',
  c_array_2d_assign: 'cpp_array_2d_assign',
  c_array_2d_declare: 'cpp_array_2d_declare',
  c_auto_declare: 'cpp_var_declare_auto',
  c_bitwise_not: 'cpp_bitwise_not',
  c_builtin_constant: 'cpp_builtin_constant',
  c_case: 'cpp_case',
  c_cast: 'cpp_cast',
  c_char_literal: 'cpp_literal_char',
  c_comment_block: 'cpp_block_comment',
  c_comment_doc: 'cpp_doc_comment',
  c_comment_line: 'cpp_comment',
  c_compound_assign: 'cpp_var_assign_compound',
  c_compound_assign_expr: 'cpp_var_assign_compound_expression',
  c_const_cast: 'cpp_cast_const',
  c_const_declare: 'cpp_var_declare_const',
  c_constexpr_declare: 'cpp_var_declare_constexpr',
  c_constructor: 'cpp_constructor',
  c_container_clear: 'cpp_container_clear',
  c_container_count: 'cpp_container_count',
  c_container_empty: 'cpp_container_empty',
  c_container_erase: 'cpp_container_erase',
  c_container_pop: 'cpp_container_pop',
  c_container_push: 'cpp_container_push',
  c_container_push_back: 'cpp_container_append',
  c_default: 'cpp_default',
  c_define: 'cpp_define',
  c_destructor: 'cpp_destructor',
  c_do_while: 'cpp_loop_do_while',
  c_dynamic_cast: 'cpp_cast_dynamic',
  c_enum: 'cpp_enum',
  c_for_loop: 'cpp_loop_for',
  c_forward_decl: 'cpp_forward_decl',
  c_free: 'cpp_free',
  c_ifdef: 'cpp_ifdef',
  c_ifndef: 'cpp_ifndef',
  c_include: 'cpp_include',
  c_include_local: 'cpp_include_local',
  c_increment: 'cpp_increment',
  c_increment_expr: 'cpp_increment_expression',
  c_lambda: 'cpp_lambda',
  c_malloc: 'cpp_malloc',
  c_map_assign: 'cpp_map_assign',
  c_math_binary: 'cpp_math_binary',
  c_math_pow: 'cpp_math_pow',
  c_math_unary: 'cpp_math_unary',
  c_memcpy: 'cpp_memory_copy',
  c_memset: 'cpp_memory_fill',
  c_namespace_def: 'cpp_namespace_def',
  c_operator_overload: 'cpp_operator_overload',
  c_override_method: 'cpp_method_override',
  c_pointer_assign: 'cpp_pointer_assign',
  c_pointer_declare: 'cpp_pointer_declare',
  c_pointer_deref: 'cpp_pointer_deref',
  c_printf: 'cpp_print_formatted',
  c_pure_virtual: 'cpp_method_virtual_pure',
  c_queue_pop: 'cpp_container_pop_queue',
  c_queue_push: 'cpp_container_push_queue',
  c_range_for: 'cpp_loop_range',
  c_raw_code: 'cpp_raw_code',
  c_raw_expression: 'cpp_raw_expression',
  c_ref_declare: 'cpp_var_declare_ref',
  c_reinterpret_cast: 'cpp_cast_reinterpret',
  c_scanf: 'cpp_input_formatted',
  c_scanf_expr: 'cpp_input_formatted_expression',
  c_sizeof: 'cpp_sizeof',
  c_stack_pop: 'cpp_container_pop_stack',
  c_stack_push: 'cpp_container_push_stack',
  c_static_cast: 'cpp_cast_static',
  c_static_declare: 'cpp_var_declare_static',
  c_static_member: 'cpp_member_static',
  c_strcat: 'cpp_cstring_append',
  c_strchr: 'cpp_cstring_find_char',
  c_strcmp: 'cpp_cstring_compare',
  c_strcpy: 'cpp_cstring_copy',
  c_strlen: 'cpp_cstring_size',
  c_strncmp: 'cpp_cstring_compare_bounded',
  c_strncpy: 'cpp_cstring_copy_bounded',
  c_strstr: 'cpp_cstring_find',
  c_struct_declare: 'cpp_struct_declare',
  c_struct_member_access: 'cpp_struct_at_member',
  c_struct_pointer_access: 'cpp_struct_at_ptr',
  c_switch: 'cpp_switch',
  c_ternary: 'cpp_ternary',
  c_throw: 'cpp_throw',
  c_try_catch: 'cpp_try_catch',
  c_typedef: 'cpp_typedef',
  c_using_alias: 'cpp_using_alias',
  c_using_namespace: 'cpp_using_namespace',
  c_var_declare_expr: 'cpp_var_declare_expression',
  c_virtual_method: 'cpp_method_virtual',
  cpp_abs: 'cpp_math_abs',
  cpp_accumulate: 'cpp_range_sum',
  cpp_atof: 'cpp_cstring_as_double',
  cpp_atoi: 'cpp_cstring_as_int',
  cpp_char_is_alpha: 'cpp_char_is_alpha',
  cpp_exit: 'cpp_program_exit',
  cpp_fill: 'cpp_range_fill',
  cpp_gcd: 'cpp_math_gcd',
  cpp_getline: 'cpp_input_line',
  cpp_iota: 'cpp_range_fill_sequence',
  cpp_isalpha: 'cpp_char_is_alpha',
  cpp_isdigit: 'cpp_char_is_digit',
  cpp_lcm: 'cpp_math_lcm',
  cpp_literal_char: 'cpp_literal_char',
  cpp_make_pair: 'cpp_pair_make',
  cpp_map_access: 'cpp_map_at',
  cpp_math_binary: 'cpp_math_binary',
  cpp_math_pow: 'cpp_math_pow',
  cpp_math_unary: 'cpp_math_unary',
  cpp_max: 'cpp_math_max',
  cpp_method_call_expr: 'cpp_method_call_expression',
  cpp_min: 'cpp_math_min',
  cpp_partial_sum: 'cpp_range_sum_partial',
  cpp_priority_queue_top: 'cpp_priority_queue_peek',
  cpp_rand: 'cpp_random_next',
  cpp_reverse: 'cpp_range_reverse',
  cpp_sort: 'cpp_range_sort',
  cpp_srand: 'cpp_random_seed',
  cpp_stack_top: 'cpp_stack_peek',
  cpp_stod: 'cpp_string_as_double',
  cpp_stoi: 'cpp_string_as_int',
  cpp_string_c_str: 'cpp_string_as_cstring',
  cpp_string_length: 'cpp_string_size',
  cpp_string_push_back: 'cpp_string_append_char',
  cpp_swap: 'cpp_var_swap',
  cpp_to_string: 'cpp_string_make',
  cpp_tolower: 'cpp_char_to_lower',
  cpp_toupper: 'cpp_char_to_upper',
  cpp_vector_pop_back: 'cpp_vector_pop',
  u_arithmetic: 'cpp_arithmetic',
  u_array_access: 'cpp_array_at',
  u_array_assign: 'cpp_array_assign',
  u_array_declare: 'cpp_array_declare',
  u_break: 'cpp_break',
  u_compare: 'cpp_compare',
  u_continue: 'cpp_continue',
  u_count_loop: 'cpp_loop_count',
  u_endl: 'cpp_endl',
  u_func_call: 'cpp_func_call',
  u_func_call_expr: 'cpp_func_call_expression',
  u_func_def: 'cpp_func_def',
  u_if: 'cpp_if',
  u_if_else: 'cpp_if_else',
  u_input: 'cpp_input',
  u_input_expr: 'cpp_input_expression',
  u_logic: 'cpp_logic',
  u_logic_not: 'cpp_logic_not',
  u_negate: 'cpp_negate',
  u_number: 'cpp_literal_number',
  u_print: 'cpp_print',
  u_return: 'cpp_return',
  u_string: 'cpp_literal_string',
  u_var_assign: 'cpp_var_assign',
  u_var_declare: 'cpp_var_declare',
  u_var_ref: 'cpp_var_ref',
  u_while_loop: 'cpp_loop_while',
}

/**
 * 把一批對應併進表裡。
 *
 * @throws 同一個舊名被登錄兩次且指向不同新名——**靜默覆蓋的症狀是
 *   「某個舊存檔裡的積木被還原成另一種積木」**，而那不會有任何錯誤訊息。
 */
export function registerBlockTypeMigration(m: Record<string, string>): void {
  for (const [舊, 新] of Object.entries(m)) {
    const 先來的 = BLOCK_TYPE_MIGRATIONS_V9_TO_V10[舊]
    if (先來的 !== undefined && 先來的 !== 新) {
      throw new Error(
        `積木型別「${舊}」被登錄兩次且指向不同新名：${先來的} 與 ${新}。`,
      )
    }
    BLOCK_TYPE_MIGRATIONS_V9_TO_V10[舊] = 新
  }
}
