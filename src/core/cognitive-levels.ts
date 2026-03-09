import type { CognitiveLevel } from './types'

/**
 * Maps block types to their cognitive level (L0/L1/L2).
 * L0 = Beginner: basic I/O, variables, simple control flow
 * L1 = Intermediate: logic ops, functions, count loops, break/continue
 * L2 = Advanced: arrays, raw code, language-specific blocks
 */
const BLOCK_LEVELS: Record<string, CognitiveLevel> = {
  // L0 - Beginner
  u_var_declare: 0,
  u_var_assign: 0,
  u_var_ref: 0,
  u_number: 0,
  u_string: 0,
  u_arithmetic: 0,
  u_compare: 0,
  u_if: 0,
  u_if_else: 0, // alias for u_if (backward compat)
  u_while_loop: 0,
  u_print: 0,
  u_input: 0,
  u_input_expr: 1,
  u_endl: 0,

  // L1 - Intermediate
  u_logic: 1,
  u_logic_not: 1,
  u_negate: 1,
  u_count_loop: 1,
  u_break: 1,
  u_continue: 1,
  u_func_def: 1,
  u_func_call: 1,
  u_func_call_expr: 1,
  u_return: 1,

  // L2 - Advanced
  u_array_declare: 2,
  u_array_access: 2,

  // C++ Basic (L1 - Intermediate)
  c_char_literal: 1,
  c_increment: 1,
  c_compound_assign: 1,
  c_for_loop: 1,
  c_do_while: 1,
  c_switch: 1,
  c_case: 1,
  c_printf: 1,
  c_scanf: 1,

  // C++ Essential (L0 - every program needs these)
  c_include: 0,
  c_using_namespace: 0,

  // C++ Special (L2 - Advanced)
  c_raw_code: 2,
  c_raw_expression: 2,
  c_include_local: 2,
  c_define: 2,
  c_ifdef: 2,
  c_ifndef: 2,
  c_comment_line: 2,
  c_comment_block: 2,
  c_comment_doc: 2,

  // C++ Advanced — Pointers (L2)
  c_pointer_declare: 2,
  c_pointer_deref: 2,
  c_address_of: 2,
  c_malloc: 2,
  c_free: 2,

  // C++ Advanced — Structures (L2)
  c_struct_declare: 2,
  c_struct_member_access: 2,
  c_struct_pointer_access: 2,

  // C++ Advanced — Strings (L2)
  c_strlen: 2,
  c_strcmp: 2,
  c_strcpy: 2,

  // C++ Advanced — Containers (L2)
  cpp_vector_declare: 2,
  cpp_vector_push_back: 2,
  cpp_vector_size: 2,
  cpp_map_declare: 2,
  cpp_string_declare: 2,
  cpp_stack_declare: 2,
  cpp_queue_declare: 2,
  cpp_set_declare: 2,
  cpp_method_call: 2,
  cpp_method_call_expr: 2,

  // C++ Advanced — Algorithms (L2)
  cpp_sort: 2,

  // C++ Advanced — OOP (L2)
  cpp_class_def: 2,
  cpp_new: 2,
  cpp_delete: 2,
  cpp_template_function: 2,
}

/** Get the cognitive level for a block type. Unknown blocks default to L2. */
export function getBlockLevel(blockType: string): CognitiveLevel {
  return BLOCK_LEVELS[blockType] ?? 2
}

/** Check if a block type is available at the given cognitive level */
export function isBlockAvailable(blockType: string, level: CognitiveLevel): boolean {
  return getBlockLevel(blockType) <= level
}

/** Filter a list of block types to those available at the given level */
export function filterBlocksByLevel(blockTypes: string[], level: CognitiveLevel): string[] {
  return blockTypes.filter(t => isBlockAvailable(t, level))
}
