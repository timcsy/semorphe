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
    // ⚠️ **明確排除，不是忘了。**「忘了」與「刻意不放」必須分得出來
    // ——與 `skipPaths` 同一種紀律（可拿性護欄會把兩者分成不同的桶）。
    //
    // `u_if_else` 被下面三個帶 `extraState` 的 `u_if` 入口取代：
    // 光是 if／if-else／if-elseif-else。同時放兩套是給學生兩條路做同一件事。
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
      'cpp_string_declare', 'cpp_string_at', 'cpp_string_length', 'cpp_string_substr', 'cpp_string_find',
      'cpp_string_append', 'cpp_string_c_str', 'cpp_to_string', 'cpp_stoi', 'cpp_stod',
      'cpp_string_empty', 'cpp_string_erase', 'cpp_string_insert', 'cpp_string_replace',
      'cpp_string_push_back', 'cpp_string_clear',
      'cpp_string_find_first_not_of', 'cpp_string_find_last_not_of',
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
      'cpp_map_declare', 'cpp_map_access', 'c_map_assign',
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
      'cpp_queue_declare', 'cpp_queue_front', 'cpp_queue_back',
      'cpp_stringstream_declare', 'cpp_istringstream_declare',
      // ⚠️ 這裡放的是**形態**，不是中性版。
      //
      // `cpp_container_push` / `cpp_container_pop` 是一個身分、多個形態（097）。
      // 工具箱要放的是學生**選得出來**的那些——「推到頂端」與「加到尾端」，
      // 而不是型別查不到時的退路。
      //
      // 一名學生回報過「stack 和 queue 的 push 意思不一樣」，而第一版把變體
      // 做出來卻沒放進工具箱——於是他**在工具箱裡找不到那顆積木**，只能拖
      // 中性版出來、接上變數、等它自己變。那比標籤說不清楚更難受。
      //
      // 預設變數名用 `stk` / `que`，沿用本分類既有的慣例
      //（`stk 的頂端元素`、`que 的前端元素`）。
      'c_stack_push', 'c_stack_pop',
      'c_queue_push', 'c_queue_pop',
      'c_container_empty',
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
 * ⚠️ 這裡原本有一份 `buildIoCategoryContents`——**與 `toolbox-builder.ts` 的
 * `buildIoContents` 是同一段邏輯的第二份拷貝，而且沒有任何產品程式碼用它**
 * （`isIoCategory` 走的是 builder 的預設路徑；只有它自己的單元測試在叫它）。
 *
 * 兩份會漂移，而漂移的那一刻沒有人會知道——實測時 builder 那份把三顆
 * `cpp_*` 的 I/O 積木靜靜丟掉，而這份拷貝有一模一樣的缺陷、一模一樣沒被抓到。
 *
 * 已刪除。要測 I/O 排序請測真的那條路（`buildToolbox` + `isIoCategory`）。
 */
