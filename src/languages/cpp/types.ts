import type { TypeEntry } from '../types'

/** C++ 基本型別清單 */
export const CPP_BASIC_TYPES: TypeEntry[] = [
  { value: 'int', labelKey: 'TYPE_INT', category: 'basic' },
  { value: 'float', labelKey: 'TYPE_FLOAT', category: 'basic' },
  { value: 'double', labelKey: 'TYPE_DOUBLE', category: 'basic' },
  { value: 'char', labelKey: 'TYPE_CHAR', category: 'basic' },
  { value: 'bool', labelKey: 'TYPE_BOOL', category: 'basic' },
  { value: 'string', labelKey: 'TYPE_STRING', category: 'basic' },
  { value: 'void', labelKey: 'TYPE_VOID', category: 'basic' },
]

/** C++ 進階型別清單 */
export const CPP_ADVANCED_TYPES: TypeEntry[] = [
  { value: 'long long', labelKey: 'TYPE_LONG_LONG', category: 'advanced' },
  { value: 'short', labelKey: 'TYPE_SHORT', category: 'advanced' },
  { value: 'unsigned int', labelKey: 'TYPE_UNSIGNED_INT', category: 'advanced' },
  { value: 'unsigned char', labelKey: 'TYPE_UNSIGNED_CHAR', category: 'advanced' },
  { value: 'long', labelKey: 'TYPE_LONG', category: 'advanced' },
  { value: 'size_t', labelKey: 'TYPE_SIZE_T', category: 'advanced' },
  { value: 'auto', labelKey: 'TYPE_AUTO', category: 'advanced' },
]

/** 所有 C++ 型別 */
export const CPP_ALL_TYPES: TypeEntry[] = [...CPP_BASIC_TYPES, ...CPP_ADVANCED_TYPES]
