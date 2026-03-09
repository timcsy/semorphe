import type { BlockSpecRegistry } from '../core/block-spec-registry'
import type { CognitiveLevel } from '../core/types'
import { isBlockAvailable, getBlockLevel } from '../core/cognitive-levels'

export interface ToolboxBuildConfig {
  blockSpecRegistry: BlockSpecRegistry
  level: CognitiveLevel
  ioPreference: 'iostream' | 'cstdio'
  msgs: Record<string, string>
  categoryColors: Record<string, string>
}

type ExtraBlockDef = string | { type: string; extraState?: Record<string, unknown>; level?: CognitiveLevel }
type ToolboxEntry = { kind: string; type: string; extraState?: Record<string, unknown> }

const CATEGORY_DEFS: Array<{
  key: string; nameKey: string; fallback: string; colorKey: string
  registryCategories: string[]; extraTypes?: ExtraBlockDef[]; excludeTypes?: string[]
}> = [
  { key: 'data', nameKey: 'CATEGORY_DATA', fallback: '資料', colorKey: 'data', registryCategories: ['data'], extraTypes: ['u_var_declare', 'u_var_assign', 'u_var_ref', 'u_number', 'u_string'] },
  { key: 'operators', nameKey: 'CATEGORY_OPERATORS', fallback: '運算', colorKey: 'operators', registryCategories: ['operators'], extraTypes: ['u_arithmetic', 'u_compare', 'u_logic', 'u_logic_not', 'u_negate'] },
  { key: 'control', nameKey: 'CATEGORY_CONTROL', fallback: '控制', colorKey: 'control', registryCategories: ['control', 'loops'], excludeTypes: ['u_if_else'], extraTypes: [
    { type: 'u_if' },
    { type: 'u_if', extraState: { hasElse: true } },
    { type: 'u_if', extraState: { elseifCount: 1, hasElse: true }, level: 1 },
    'u_while_loop', 'u_count_loop', 'u_break', 'u_continue',
  ] },
  { key: 'functions', nameKey: 'CATEGORY_FUNCTIONS', fallback: '函式', colorKey: 'functions', registryCategories: ['functions'], extraTypes: ['u_func_def', 'u_func_call', 'u_func_call_expr', 'u_return'] },
  { key: 'arrays', nameKey: 'CATEGORY_ARRAYS', fallback: '陣列', colorKey: 'arrays', registryCategories: ['arrays'], extraTypes: ['u_array_declare', 'u_array_access', 'u_array_assign'] },
  { key: 'cpp_basic', nameKey: 'CATEGORY_CPP_BASIC', fallback: 'C++ 基礎', colorKey: 'cpp_basic', registryCategories: ['cpp_basic', 'conditions', 'preprocessor'] },
  { key: 'cpp_pointers', nameKey: 'CATEGORY_CPP_POINTERS', fallback: 'C++ 指標', colorKey: 'cpp_pointers', registryCategories: ['pointers'] },
  { key: 'cpp_structs', nameKey: 'CATEGORY_CPP_STRUCTS', fallback: 'C++ 結構/類別', colorKey: 'cpp_structs', registryCategories: ['structures', 'oop'] },
  { key: 'cpp_strings', nameKey: 'CATEGORY_CPP_STRINGS', fallback: 'C++ 字串', colorKey: 'cpp_strings', registryCategories: ['strings'] },
  { key: 'cpp_containers', nameKey: 'CATEGORY_CPP_CONTAINERS', fallback: 'C++ 容器', colorKey: 'cpp_containers', registryCategories: ['containers'] },
  { key: 'cpp_algorithms', nameKey: 'CATEGORY_CPP_ALGORITHMS', fallback: 'C++ 演算法', colorKey: 'cpp_algorithms', registryCategories: ['algorithms'] },
  { key: 'cpp_special', nameKey: 'CATEGORY_CPP_SPECIAL', fallback: 'C++ 特殊', colorKey: 'cpp_special', registryCategories: ['special', 'preprocessor'] },
]

export function buildToolbox(config: ToolboxBuildConfig): object {
  const { blockSpecRegistry, level: lv, ioPreference: ioPref, msgs, categoryColors } = config

  const registryBlocks = (category: string): { kind: string; type: string }[] => {
    const specs = blockSpecRegistry.listByCategory(category, lv)
    return specs
      .filter(s => {
        const blockType = (s.blockDef as Record<string, unknown>)?.type as string | undefined
        return blockType && isBlockAvailable(blockType, lv)
      })
      .map(s => ({ kind: 'block', type: (s.blockDef as Record<string, unknown>).type as string }))
  }

  const buildIoCategory = () => {
    const ioSpecs = [
      ...blockSpecRegistry.listByCategory('io', lv),
      ...blockSpecRegistry.listByCategory('cpp_io', lv),
    ]
    const ioTypes = ioSpecs
      .map(s => (s.blockDef as Record<string, unknown>)?.type as string)
      .filter(t => t && isBlockAvailable(t, lv))

    const ensureTypes = ['u_print', 'u_input', 'u_endl', 'c_printf', 'c_scanf']
    for (const t of ensureTypes) {
      if (!ioTypes.includes(t) && isBlockAvailable(t, lv)) {
        ioTypes.push(t)
      }
    }

    const universalIo = ioTypes.filter(t => t.startsWith('u_'))
    const cppIo = ioTypes.filter(t => t.startsWith('c_'))
    const sorted = ioPref === 'iostream'
      ? [...universalIo, ...cppIo]
      : [...cppIo, ...universalIo]
    return sorted.map(t => ({ kind: 'block', type: t }))
  }

  const categories = CATEGORY_DEFS.map(def => {
    const excludeSet = new Set(def.excludeTypes ?? [])
    const blockSet = new Set<string>()
    for (const cat of def.registryCategories) {
      for (const b of registryBlocks(cat)) {
        if (!excludeSet.has(b.type)) blockSet.add(b.type)
      }
    }
    const extraReplacements = new Map<string, ToolboxEntry[]>()
    const extraAppend: ToolboxEntry[] = []
    if (def.extraTypes) {
      for (const t of def.extraTypes) {
        if (typeof t === 'string') {
          if (!isBlockAvailable(t, lv)) continue
          if (!blockSet.has(t)) extraAppend.push({ kind: 'block', type: t })
          blockSet.add(t)
        } else {
          const effectiveLevel = t.level ?? getBlockLevel(t.type)
          if (effectiveLevel > lv) continue
          if (!extraReplacements.has(t.type)) extraReplacements.set(t.type, [])
          extraReplacements.get(t.type)!.push({ kind: 'block', type: t.type, ...(t.extraState ? { extraState: t.extraState } : {}) })
        }
      }
    }
    const contents: ToolboxEntry[] = []
    for (const t of blockSet) {
      if (extraReplacements.has(t)) {
        contents.push(...extraReplacements.get(t)!)
      } else {
        contents.push({ kind: 'block', type: t })
      }
    }
    contents.push(...extraAppend)
    return {
      kind: 'category',
      name: msgs[def.nameKey] || def.fallback,
      colour: categoryColors[def.colorKey] || categoryColors.data,
      contents,
    }
  })

  const funcIdx = categories.findIndex(c => c.name === (msgs['CATEGORY_FUNCTIONS'] || '函式'))
  const ioCategory = {
    kind: 'category',
    name: msgs['CATEGORY_IO'] || '輸入/輸出',
    colour: categoryColors.io,
    contents: buildIoCategory(),
  }
  categories.splice(funcIdx + 1, 0, ioCategory)

  return {
    kind: 'categoryToolbox',
    contents: categories.filter(c => c.contents.length > 0),
  }
}
