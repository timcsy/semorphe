import type { BlockSpecRegistry } from '../../core/block-spec-registry'
import type { CognitiveLevel } from '../../core/types'
import { isBlockAvailable } from '../../core/cognitive-levels'
import type { ToolboxCategoryDef } from '../../ui/toolbox-builder'

/**
 * C++ language category definitions for the toolbox.
 * Moved from hardcoded CATEGORY_DEFS in toolbox-builder.ts.
 */
export const cppCategoryDefs: ToolboxCategoryDef[] = [
  {
    key: 'data', nameKey: 'CATEGORY_DATA', fallback: '資料', colorKey: 'data',
    registryCategories: ['data'],
    extraTypes: ['u_var_declare', 'u_var_assign', 'u_var_ref', 'u_number', 'u_string'],
  },
  {
    key: 'operators', nameKey: 'CATEGORY_OPERATORS', fallback: '運算', colorKey: 'operators',
    registryCategories: ['operators'],
    extraTypes: ['u_arithmetic', 'u_compare', 'u_logic', 'u_logic_not', 'u_negate'],
  },
  {
    key: 'control', nameKey: 'CATEGORY_CONTROL', fallback: '控制', colorKey: 'control',
    registryCategories: ['control', 'loops'],
    excludeTypes: ['u_if_else'],
    extraTypes: [
      { type: 'u_if' },
      { type: 'u_if', extraState: { hasElse: true } },
      { type: 'u_if', extraState: { elseifCount: 1, hasElse: true }, level: 1 },
      'u_while_loop', 'u_count_loop', 'u_break', 'u_continue',
    ],
  },
  {
    key: 'functions', nameKey: 'CATEGORY_FUNCTIONS', fallback: '函式', colorKey: 'functions',
    registryCategories: ['functions'],
    extraTypes: ['u_func_def', 'u_func_call', 'u_func_call_expr', 'u_return'],
  },
  {
    key: 'arrays', nameKey: 'CATEGORY_ARRAYS', fallback: '陣列', colorKey: 'arrays',
    registryCategories: ['arrays'],
    extraTypes: ['u_array_declare', 'u_array_access', 'u_array_assign'],
  },
  {
    key: 'io', nameKey: 'CATEGORY_IO', fallback: '輸入/輸出', colorKey: 'io',
    registryCategories: ['io', 'cpp_io'],
    isIoCategory: true,
  },
  {
    key: 'cpp_basic', nameKey: 'CATEGORY_CPP_BASIC', fallback: 'C++ 基礎', colorKey: 'cpp_basic',
    registryCategories: ['cpp_basic', 'conditions', 'preprocessor'],
  },
  {
    key: 'cpp_pointers', nameKey: 'CATEGORY_CPP_POINTERS', fallback: 'C++ 指標', colorKey: 'cpp_pointers',
    registryCategories: ['pointers'],
  },
  {
    key: 'cpp_structs', nameKey: 'CATEGORY_CPP_STRUCTS', fallback: 'C++ 結構/類別', colorKey: 'cpp_structs',
    registryCategories: ['structures', 'oop'],
  },
  {
    key: 'cpp_strings', nameKey: 'CATEGORY_CPP_STRINGS', fallback: 'C++ 字串', colorKey: 'cpp_strings',
    registryCategories: ['strings'],
  },
  {
    key: 'cpp_containers', nameKey: 'CATEGORY_CPP_CONTAINERS', fallback: 'C++ 容器', colorKey: 'cpp_containers',
    registryCategories: ['containers'],
  },
  {
    key: 'cpp_algorithms', nameKey: 'CATEGORY_CPP_ALGORITHMS', fallback: 'C++ 演算法', colorKey: 'cpp_algorithms',
    registryCategories: ['algorithms'],
  },
  {
    key: 'cpp_special', nameKey: 'CATEGORY_CPP_SPECIAL', fallback: 'C++ 特殊', colorKey: 'cpp_special',
    registryCategories: ['special', 'preprocessor'],
  },
]

/**
 * Build I/O category contents with iostream/cstdio sorting.
 * Extracted from toolbox-builder.ts to be reusable by the language module.
 */
export function buildIoCategoryContents(
  blockSpecRegistry: BlockSpecRegistry,
  level: CognitiveLevel,
  ioPreference: 'iostream' | 'cstdio',
): { kind: string; type: string }[] {
  const ioSpecs = [
    ...blockSpecRegistry.listByCategory('io', level),
    ...blockSpecRegistry.listByCategory('cpp_io', level),
  ]
  const ioTypes = ioSpecs
    .map(s => (s.blockDef as Record<string, unknown>)?.type as string)
    .filter(t => t && isBlockAvailable(t, level))

  const ensureTypes = ['u_print', 'u_input', 'u_input_expr', 'u_endl', 'c_printf', 'c_scanf']
  for (const t of ensureTypes) {
    if (!ioTypes.includes(t) && isBlockAvailable(t, level)) {
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
