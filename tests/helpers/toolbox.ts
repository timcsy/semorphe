/**
 * 工具箱的實測入口——**從實際載入後的狀態量，不讀靜態設定**
 *
 * `build-guardrail` 第 4 步：「勝負常常取決於模組匯入順序，讀設定檔算不出來。」
 *
 * ⚠️ **`visibleConcepts` 要餵全部概念，不要餵單一 topic。**
 *
 * 規劃階段第一版掃描餵的是 `cpp-beginner` 的可見集合，於是被課程可見度擋掉的
 * 積木一顆都沒被數到——報「拿不到 6 顆」，實際是 10 顆。課程收不收錄是策展，
 * 與「使用者有沒有入口拿到它」是兩件事，混在一起量會**低估**。
 */
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { buildToolbox } from '../../src/ui/toolbox-builder'
import { CATEGORY_COLORS } from '../../src/ui/theme/category-colors'
import type { ConceptDefJSON, BlockProjectionJSON } from '../../src/core/types'
import { universalConcepts, universalBlocks, UNIVERSAL_OWNER } from '../../src/blocks/universal'
import { coreConcepts, coreBlocks, CORE_OWNER } from '../../src/languages/cpp/core'
import { allStdModules } from '../../src/languages/cpp/std'
import { cppCategoryDefs } from '../../src/languages/cpp/toolbox-categories'

export interface ToolboxSnapshot {
  /** 分類順序即教學順序——**這個陣列的順序本身就是被測的東西** */
  categories: { name: string; blocks: string[] }[]
}

export interface BlockOrigin {
  type: string
  /** `<stack>`／`(core)`／`(universal)` */
  owner: string
}

export interface LoadedToolbox {
  registry: BlockSpecRegistry
  allConcepts: ConceptDefJSON[]
  allProjections: BlockProjectionJSON[]
  /** 每顆積木型別 → 它的來源模組 */
  origins: BlockOrigin[]
  snapshot: ToolboxSnapshot
  /** 積木型別 → 收它的分類標題（可能不只一個） */
  categoriesOf: Map<string, string[]>
}

function typeOf(proj: BlockProjectionJSON): string {
  return (proj.blockDef as unknown as { type: string }).type
}

/**
 * 載入全部宣告並組出工具箱。
 *
 * @param extraConcepts   合成注入用（雙向注入測試）
 * @param extraProjections 合成注入用
 */
export function loadToolbox(
  extraConcepts: ConceptDefJSON[] = [],
  extraProjections: BlockProjectionJSON[] = [],
): LoadedToolbox {
  const allConcepts: ConceptDefJSON[] = [
    ...universalConcepts,
    ...coreConcepts,
    ...allStdModules.flatMap((m) => m.concepts),
    ...extraConcepts,
  ]
  const allProjections: BlockProjectionJSON[] = [
    ...universalBlocks,
    ...coreBlocks,
    ...allStdModules.flatMap((m) => m.blocks),
    // 合成注入預設蓋核心的章；要驗「加一顆元件到某模組」就自己帶 owner
    ...extraProjections.map((b) => ({ ...b, owner: b.owner ?? CORE_OWNER })),
  ]

  const registry = new BlockSpecRegistry()
  registry.loadFromSplit(allConcepts, allProjections)

  const origins: BlockOrigin[] = [
    ...universalBlocks.map((b) => ({ type: typeOf(b), owner: UNIVERSAL_OWNER })),
    ...coreBlocks.map((b) => ({ type: typeOf(b), owner: CORE_OWNER })),
    ...allStdModules.flatMap((m) => m.blocks.map((b) => ({ type: typeOf(b), owner: m.header }))),
    ...extraProjections.map((b) => ({ type: typeOf(b), owner: b.owner ?? CORE_OWNER })),
  ]

  // ⚠️ 全部概念可見——見檔頭
  const visibleConcepts = new Set(allConcepts.map((c) => c.conceptId))

  const built = buildToolbox({
    blockSpecRegistry: registry,
    visibleConcepts,
    ioPreference: 'iostream',
    msgs: {},
    categoryColors: CATEGORY_COLORS,
    categoryDefs: cppCategoryDefs,
  }) as { contents: { name: string; contents: { type: string }[] }[] }

  const snapshot: ToolboxSnapshot = {
    categories: built.contents.map((c) => ({ name: c.name, blocks: c.contents.map((b) => b.type) })),
  }

  const categoriesOf = new Map<string, string[]>()
  for (const cat of snapshot.categories) {
    for (const t of cat.blocks) {
      const list = categoriesOf.get(t)
      if (list) {
        if (!list.includes(cat.name)) list.push(cat.name)
      } else {
        categoriesOf.set(t, [cat.name])
      }
    }
  }

  return { registry, allConcepts, allProjections, origins, snapshot, categoriesOf }
}

/** 課程清單的快照——成員是策展，這裡只負責留照片 */
export function curriculumSnapshot(topic: {
  id?: string
  levelTree?: unknown
}): { id: string; levels: { id: string; label: string; concepts: string[] }[] } {
  const levels: { id: string; label: string; concepts: string[] }[] = []
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return
    const n = node as { id?: string; label?: string; concepts?: string[]; children?: unknown[] }
    if (n.id) levels.push({ id: n.id, label: n.label ?? '', concepts: [...(n.concepts ?? [])] })
    for (const c of n.children ?? []) walk(c)
  }
  walk(topic.levelTree)
  return { id: topic.id ?? '(未命名)', levels }
}
