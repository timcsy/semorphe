import type { TypeEntry } from '../types'

/** Python 基本型別清單 */
export const PYTHON_BASIC_TYPES: TypeEntry[] = [
  { value: 'int', labelKey: 'TYPE_PY_INT', category: 'basic' },
  { value: 'float', labelKey: 'TYPE_PY_FLOAT', category: 'basic' },
  { value: 'str', labelKey: 'TYPE_PY_STR', category: 'basic' },
  { value: 'bool', labelKey: 'TYPE_PY_BOOL', category: 'basic' },
  { value: 'list', labelKey: 'TYPE_PY_LIST', category: 'basic' },
  { value: 'dict', labelKey: 'TYPE_PY_DICT', category: 'basic' },
]

/** Python 進階型別清單 */
export const PYTHON_ADVANCED_TYPES: TypeEntry[] = [
  { value: 'tuple', labelKey: 'TYPE_PY_TUPLE', category: 'advanced' },
  { value: 'set', labelKey: 'TYPE_PY_SET', category: 'advanced' },
  { value: 'None', labelKey: 'TYPE_PY_NONE', category: 'advanced' },
]

/** 所有 Python 型別 */
export const PYTHON_ALL_TYPES: TypeEntry[] = [...PYTHON_BASIC_TYPES, ...PYTHON_ADVANCED_TYPES]
