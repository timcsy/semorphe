import type { BlockSpecRegistry } from '../core/block-spec-registry'
import type { ToolboxCategoryDef } from '../core/types'

export type { ToolboxCategoryDef }

export interface ToolboxBuildConfig {
  blockSpecRegistry: BlockSpecRegistry
  visibleConcepts: Set<string>
  ioPreference: 'iostream' | 'cstdio'
  msgs: Record<string, string>
  categoryColors: Record<string, string>
  /** External category definitions (from language module). If not provided, uses empty array. */
  categoryDefs?: ToolboxCategoryDef[]
}

type ToolboxEntry = { kind: string; type: string; extraState?: Record<string, unknown> }

export function buildToolbox(config: ToolboxBuildConfig): object {
  const { blockSpecRegistry, visibleConcepts, ioPreference: ioPref, msgs, categoryColors, categoryDefs = [] } = config

  const isVisible = (blockType: string): boolean =>
    blockSpecRegistry.isBlockVisible(blockType, visibleConcepts)

  const registryBlocks = (category: string): { kind: string; type: string }[] => {
    const specs = blockSpecRegistry.listByCategory(category, visibleConcepts)
    return specs
      .filter(s => {
        const blockType = (s.blockDef as Record<string, unknown>)?.type as string | undefined
        return blockType && isVisible(blockType)
      })
      .map(s => ({ kind: 'block', type: (s.blockDef as Record<string, unknown>).type as string }))
  }

  const buildIoContents = (def: ToolboxCategoryDef): ToolboxEntry[] => {
    if (def.buildContents) {
      return def.buildContents(blockSpecRegistry, visibleConcepts, ioPref)
    }
    // Default I/O category builder
    const ioSpecs = def.registryCategories.flatMap(cat =>
      blockSpecRegistry.listByCategory(cat, visibleConcepts)
    )
    const ioTypes = ioSpecs
      .map(s => (s.blockDef as Record<string, unknown>)?.type as string)
      .filter(t => t && isVisible(t))

    const ensureTypes = ['u_print', 'u_input', 'u_input_expr', 'u_endl', 'c_printf', 'c_scanf']
    for (const t of ensureTypes) {
      if (!ioTypes.includes(t) && isVisible(t)) {
        ioTypes.push(t)
      }
    }

    // ⚠️ **分成兩堆時，第二堆要是「其餘」，不是另一個前綴。**
    //
    // 這裡原本寫 `filter(t => t.startsWith('c_'))`，於是 `cpp_getline`、
    // `cpp_ifstream_declare`、`cpp_ofstream_declare` 三顆**兩邊都不屬於**，
    // 被這個排序函式**靜靜地丟掉**——它們的 `category` 明明就是 `'io'`。
    //
    // 那不是「忘了加進清單」，是**宣告是對的，而呈現層把它吃掉了**。
    // 症狀完全一樣（使用者拿不到），根因差很遠。
    const universalIo = ioTypes.filter(t => t.startsWith('u_'))
    const langIo = ioTypes.filter(t => !t.startsWith('u_'))
    const sorted = ioPref === 'iostream'
      ? [...universalIo, ...langIo]
      : [...langIo, ...universalIo]
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
    const extraAdded = new Set<string>()
    if (def.extraTypes) {
      for (const t of def.extraTypes) {
        if (typeof t === 'string') {
          if (!isVisible(t)) continue
          if (!blockSet.has(t) && !extraAdded.has(t)) {
            extraAppend.push({ kind: 'block', type: t })
            extraAdded.add(t)
          }
        } else {
          if (!isVisible(t.type)) continue
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
