import type { BlockSpecRegistry } from '../../core/block-spec-registry'
import type { ToolboxCategoryDef } from '../../core/types'

/**
 * C++ language toolbox categories — organized by cognitive intent.
 *
 * Design principle (from first-principles §1.3, §2.4):
 * Categories answer "what does the student want to DO?" (semantic intent),
 * not "what C++ syntax feature is this?" (language taxonomy).
 *
 * Each category maps to one or more registry categories from block JSONs,
 * plus explicit extraTypes for blocks that need to be pulled from other
 * registry categories.
 */
export const cppCategoryDefs: ToolboxCategoryDef[] = [
  // ── Universal categories (language-agnostic concepts) ──

  {
    key: 'data', nameKey: 'CATEGORY_DATA', fallback: '資料', colorKey: 'data',
    registryCategories: ['data', 'values', 'variables'],
    extraTypes: ['u_var_declare', 'u_var_assign', 'u_var_ref', 'u_number', 'u_string'],
  },
  {
    key: 'operators', nameKey: 'CATEGORY_OPERATORS', fallback: '運算', colorKey: 'operators',
    registryCategories: ['operators', 'math'],
    extraTypes: [
      'u_arithmetic', 'u_compare', 'u_logic', 'u_logic_not', 'u_negate',
      // stdlib math & random
      'cpp_abs', 'cpp_rand', 'cpp_srand',
    ],
  },
  {
    key: 'control', nameKey: 'CATEGORY_CONTROL', fallback: '控制', colorKey: 'control',
    registryCategories: ['control', 'loops', 'conditions'],
    excludeTypes: ['u_if_else'],
    extraTypes: [
      { type: 'u_if' },
      { type: 'u_if', extraState: { hasElse: true } },
      { type: 'u_if', extraState: { elseifCount: 1, hasElse: true } },
      'u_while_loop', 'u_count_loop', 'u_break', 'u_continue',
      // stdlib
      'cpp_exit',
    ],
  },
  {
    key: 'functions', nameKey: 'CATEGORY_FUNCTIONS', fallback: '函式', colorKey: 'functions',
    registryCategories: ['functions', 'templates'],
    extraTypes: [
      'u_func_def', 'u_func_call', 'u_func_call_expr', 'u_return',
      // generic method call (language-level, not container-specific)
      'cpp_method_call', 'cpp_method_call_expr',
    ],
  },
  {
    key: 'io', nameKey: 'CATEGORY_IO', fallback: '輸入/輸出', colorKey: 'io',
    registryCategories: ['io', 'cpp_io'],
    isIoCategory: true,
  },

  // ── Data structure categories (organized by cognitive intent) ──

  {
    key: 'arrays_lists', nameKey: 'CATEGORY_ARRAYS_LISTS', fallback: '陣列與列表', colorKey: 'arrays',
    registryCategories: ['arrays', 'algorithms'],
    extraTypes: [
      'u_array_declare', 'u_array_access', 'u_array_assign',
      // vector (from containers registry)
      'cpp_vector_declare', 'cpp_vector_size', 'cpp_vector_pop_back', 'cpp_vector_back',
      // generic container ops commonly used with vectors/arrays
      'c_container_push_back', 'c_container_empty', 'c_container_clear',
    ],
  },
  {
    key: 'text', nameKey: 'CATEGORY_TEXT', fallback: '文字', colorKey: 'cpp_strings',
    registryCategories: ['strings'],
    extraTypes: [
      // C++ string (from containers registry)
      'cpp_string_declare', 'cpp_string_length', 'cpp_string_substr', 'cpp_string_find',
      'cpp_string_append', 'cpp_string_c_str', 'cpp_to_string', 'cpp_stoi', 'cpp_stod',
      'cpp_string_empty', 'cpp_string_erase', 'cpp_string_insert', 'cpp_string_replace',
      'cpp_string_push_back', 'cpp_string_clear',
      // stdlib char functions
      'cpp_isalpha', 'cpp_isdigit', 'cpp_toupper', 'cpp_tolower',
      // stdlib conversion
      'cpp_atoi', 'cpp_atof',
    ],
  },
  {
    key: 'maps_sets', nameKey: 'CATEGORY_MAPS_SETS', fallback: '對應與集合', colorKey: 'cpp_containers',
    registryCategories: [],
    extraTypes: [
      'cpp_map_declare', 'cpp_map_access',
      'cpp_set_declare', 'cpp_set_insert',
      'cpp_pair_declare', 'cpp_make_pair',
      // generic container ops commonly used with maps/sets
      'c_container_erase', 'c_container_count',
    ],
  },
  {
    key: 'stacks_queues', nameKey: 'CATEGORY_STACKS_QUEUES', fallback: '堆疊與佇列', colorKey: 'cpp_containers',
    registryCategories: [],
    extraTypes: [
      'cpp_stack_declare', 'cpp_stack_top',
      'cpp_queue_declare', 'cpp_queue_front',
      'cpp_stringstream_declare',
      // generic container ops commonly used with stacks/queues
      'c_container_push', 'c_container_pop',
    ],
  },

  // ── Memory & types ──

  {
    key: 'pointers_memory', nameKey: 'CATEGORY_POINTERS_MEMORY', fallback: '指標與記憶體', colorKey: 'cpp_pointers',
    registryCategories: ['pointers'],
    extraTypes: [
      // memory operations (from strings registry — memset/memcpy)
      'c_memset', 'c_memcpy',
    ],
  },
  {
    key: 'structs_classes', nameKey: 'CATEGORY_STRUCTS_CLASSES', fallback: '結構與類別', colorKey: 'cpp_structs',
    registryCategories: ['structures', 'oop'],
  },

  // ── Program infrastructure ──

  {
    key: 'program_config', nameKey: 'CATEGORY_PROGRAM_CONFIG', fallback: '程式設定', colorKey: 'cpp_special',
    registryCategories: ['preprocessor', 'special', 'cpp_basic'],
  },
]

/**
 * Build I/O category contents with iostream/cstdio sorting.
 * Extracted from toolbox-builder.ts to be reusable by the language module.
 */
export function buildIoCategoryContents(
  blockSpecRegistry: BlockSpecRegistry,
  visibleConcepts: Set<string>,
  ioPreference: 'iostream' | 'cstdio',
): { kind: string; type: string }[] {
  const ioSpecs = [
    ...blockSpecRegistry.listByCategory('io', visibleConcepts),
    ...blockSpecRegistry.listByCategory('cpp_io', visibleConcepts),
  ]
  const ioTypes = ioSpecs
    .map(s => (s.blockDef as Record<string, unknown>)?.type as string)
    .filter(t => t && blockSpecRegistry.isBlockVisible(t, visibleConcepts))

  const ensureTypes = ['u_print', 'u_input', 'u_input_expr', 'u_endl', 'c_printf', 'c_scanf']
  for (const t of ensureTypes) {
    if (!ioTypes.includes(t) && blockSpecRegistry.isBlockVisible(t, visibleConcepts)) {
      ioTypes.push(t)
    }
  }

  const universalIo = ioTypes.filter(t => t.startsWith('u_'))
  const cppIo = ioTypes.filter(t => t.startsWith('c_'))
  const sorted = ioPreference === 'iostream'
    ? [...universalIo, ...cppIo]
    : [...cppIo, ...universalIo]
  return sorted.map(t => ({ kind: 'block', type: t }))
}
