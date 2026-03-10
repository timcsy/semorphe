import type { BlockSpecRegistry } from '../core/block-spec-registry'
import type { CognitiveLevel } from '../core/types'
import { isBlockAvailable, getBlockLevel } from '../core/cognitive-levels'

type ExtraBlockDef = string | { type: string; extraState?: Record<string, unknown>; level?: CognitiveLevel }

export interface ToolboxCategoryDef {
  key: string
  nameKey: string
  fallback: string
  colorKey: string
  registryCategories: string[]
  extraTypes?: ExtraBlockDef[]
  excludeTypes?: string[]
  /** If true, this category uses the I/O builder (iostream/cstdio sorting) */
  isIoCategory?: boolean
  /** Custom content builder for special categories */
  buildContents?: (registry: BlockSpecRegistry, level: CognitiveLevel, ioPreference: 'iostream' | 'cstdio') => { kind: string; type: string }[]
}

export interface ToolboxBuildConfig {
  blockSpecRegistry: BlockSpecRegistry
  level: CognitiveLevel
  ioPreference: 'iostream' | 'cstdio'
  msgs: Record<string, string>
  categoryColors: Record<string, string>
  /** External category definitions (from language module). If not provided, uses empty array. */
  categoryDefs?: ToolboxCategoryDef[]
}

type ToolboxEntry = { kind: string; type: string; extraState?: Record<string, unknown> }

export function buildToolbox(config: ToolboxBuildConfig): object {
  const { blockSpecRegistry, level: lv, ioPreference: ioPref, msgs, categoryColors, categoryDefs = [] } = config

  const registryBlocks = (category: string): { kind: string; type: string }[] => {
    const specs = blockSpecRegistry.listByCategory(category, lv)
    return specs
      .filter(s => {
        const blockType = (s.blockDef as Record<string, unknown>)?.type as string | undefined
        return blockType && isBlockAvailable(blockType, lv)
      })
      .map(s => ({ kind: 'block', type: (s.blockDef as Record<string, unknown>).type as string }))
  }

  const buildIoContents = (def: ToolboxCategoryDef): ToolboxEntry[] => {
    if (def.buildContents) {
      return def.buildContents(blockSpecRegistry, lv, ioPref)
    }
    // Default I/O category builder
    const ioSpecs = def.registryCategories.flatMap(cat =>
      blockSpecRegistry.listByCategory(cat, lv)
    )
    const ioTypes = ioSpecs
      .map(s => (s.blockDef as Record<string, unknown>)?.type as string)
      .filter(t => t && isBlockAvailable(t, lv))

    const ensureTypes = ['u_print', 'u_input', 'u_input_expr', 'u_endl', 'c_printf', 'c_scanf']
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

  const categories = categoryDefs.map(def => {
    // I/O category: special sorting logic
    if (def.isIoCategory) {
      return {
        kind: 'category',
        name: msgs[def.nameKey] || def.fallback,
        colour: categoryColors[def.colorKey] || categoryColors.data,
        contents: buildIoContents(def),
      }
    }

    // Standard category
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

  return {
    kind: 'categoryToolbox',
    contents: categories.filter(c => c.contents.length > 0),
  }
}
