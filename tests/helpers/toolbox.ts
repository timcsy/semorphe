/**
 * 工具箱的實測入口——**從實際載入後的狀態量，不讀靜態設定**
 *
 * `build-guardrail` 第 4 步：「勝負常常取決於模組匯入順序，讀設定檔算不出來。」
 *
 * ⚠️ **`visibleComponents` 要餵全部概念，不要餵單一 topic。**
 *
 * 規劃階段第一版掃描餵的是 `cpp-beginner` 的可見集合，於是被課程可見度擋掉的
 * 積木一顆都沒被數到——報「拿不到 6 顆」，實際是 10 顆。課程收不收錄是策展，
 * 與「使用者有沒有入口拿到它」是兩件事，混在一起量會**低估**。
 */
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { filterByTarget } from '../../src/core/component/traits'
import { buildToolbox } from '../../src/ui/toolbox-builder'
import { toolboxCategoriesOf, declaredToolboxLanguages } from '../../src/core/toolbox-categories'
// ⚠️ **副作用匯入**：讓 Python 的分類宣告自己（與 `all-declarations.ts` 的
// 身分改名表同一個形狀）。少了它，`declaredToolboxLanguages()` 看不到 python，
// 而可拿性護欄會說 `python_print` 拿不到——**而它其實有分類，只是沒人載入宣告**。
import '../../src/languages/python/toolbox-categories'
import { CATEGORY_COLORS } from '../../src/ui/theme/category-colors'
import type { ToolboxCategoryDef } from '../../src/core/types'
import type { ComponentDefJSON, BlockProjectionJSON } from '../../src/core/types'
import { universalBlocks, UNIVERSAL_OWNER } from '../../src/core/universal'
import { coreBlocks, CORE_OWNER } from '../../src/languages/cpp/core'
import { allCppComponents, allCppProjections } from '../../src/languages/cpp/all-declarations'
import { allStdModules } from '../../src/languages/cpp/std'
import { componentBlocks, componentBlocksNotIn } from '../../src/core/component/registry'
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
  allComponents: ComponentDefJSON[]
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
 * @param extraComponents   合成注入用（雙向注入測試）
 * @param extraProjections 合成注入用
 */
export function loadToolbox(
  extraComponents: ComponentDefJSON[] = [],
  extraProjections: BlockProjectionJSON[] = [],
  /**
   * 用哪個目標的能力過濾（spec 142）。
   * ⚠️ **省略 ＝ 不過濾**——既有的每一條護欄都不帶它，行為必須一格不變。
   */
  target?: { provides?: readonly string[] },
  /**
   * 用哪一份分類建工具箱。
   *
   * 🔴 **省略 ＝ 只有 cpp 的，行為一格不變。**
   *
   * ⚠️ 第一版讓這裡吃**所有語言的聯集**，而工具箱快照當場紅：
   * cpp 使用者的工具箱**多出一個空的「輸入輸出」分類**——那是 Python 的。
   *
   * > **一個沒有積木的分類是一個空段落，而空段落與「這個分類就是這麼小」
   * > 長得一模一樣**（可拿性護欄的檔頭早就寫著這句話）。
   *
   * 🟢 正解：**production 一次只建一個語言的工具箱**，所以這裡也一次一個；
   * 要問「有沒有【某個】工具箱給得出這顆積木」的是可拿性護欄，
   * 而它該做的是**逐語言量、把【發現】聯集起來**，不是把【分類】聯集起來。
   */
  categoryDefs: ToolboxCategoryDef[] = cppCategoryDefs,
): LoadedToolbox {
  // ⚠️ **走 production 的同一個組裝函式。**
  //
  // 在此之前這裡自己列了一份，而 `app.ts` 列的是另一份（載入沒蓋 owner 章的
  // 原始 JSON）。兩份看起來一樣，於是護欄與快照全綠，而**正式路徑上的通用積木
  // 整批從工具箱消失**——使用者截圖才發現。
  //
  // 組裝只留一份，測試與 production 就不可能分歧。
  const allComponents: ComponentDefJSON[] = [...allCppComponents(), ...extraComponents]
  const allProjections: BlockProjectionJSON[] = [
    ...allCppProjections(),
    // 合成注入預設蓋核心的章；要驗「加一顆元件到某模組」就自己帶 owner
    ...extraProjections.map((b) => ({ ...b, owner: b.owner ?? CORE_OWNER })),
  ]

  const registry = new BlockSpecRegistry()
  registry.loadFromSplit(allComponents, allProjections)

  const origins: BlockOrigin[] = [
    ...universalBlocks.map((b) => ({ type: typeOf(b), owner: UNIVERSAL_OWNER })),
    ...coreBlocks.map((b) => ({ type: typeOf(b), owner: CORE_OWNER })),
    // ⚠️ 這裡原本只走 `allStdModules`——**第三份各自組裝**（前兩份見
    // `all-declarations.ts` 的檔頭與 `component-scan.ts` 的 `allComponentDefs`）。
    // 元件膠囊接上正式路徑之後，可拿性護欄從這裡回報「`cpp_vector_declare`
    // 是幽靈積木」——**一顆剛搬好的元件看起來像被刪掉了。**
    ...allStdModules.flatMap((m) => [
      ...(componentBlocks(m.header) as BlockProjectionJSON[]).map((b) => ({ type: typeOf(b), owner: m.header })),
      ...m.blocks.map((b) => ({ type: typeOf(b), owner: m.header })),
    ]),
    // ⚠️ 其餘 owner 的膠囊積木（例如 `(core)`）——見 `componentBlocksNotIn` 的檔頭。
    ...(componentBlocksNotIn(allStdModules.map((m) => m.header)) as BlockProjectionJSON[]).map((b) => ({
      type: typeOf(b),
      owner: (b as { owner?: string }).owner ?? CORE_OWNER,
    })),
    ...extraProjections.map((b) => ({ type: typeOf(b), owner: b.owner ?? CORE_OWNER })),
  ]

  // ⚠️ 全部概念可見——見檔頭
  const allVisible = new Set(allComponents.map((c) => c.componentId))
  // 🔴 走 production 的**同一個**過濾函式，不在這裡重寫一份會漂移的判準。
  const visibleComponents = target ? filterByTarget(allVisible, target) : allVisible

  const built = buildToolbox({
    blockSpecRegistry: registry,
    visibleComponents,
    ioPreference: 'iostream',
    msgs: {},
    categoryColors: CATEGORY_COLORS,
    categoryDefs,
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

  return { registry, allComponents, allProjections, origins, snapshot, categoriesOf }
}

/** 課程清單的快照——成員是策展，這裡只負責留照片 */
export function curriculumSnapshot(topic: {
  id?: string
  levelTree?: unknown
}): { id: string; levels: { id: string; label: string; components: string[] }[] } {
  const levels: { id: string; label: string; components: string[] }[] = []
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return
    const n = node as { id?: string; label?: string; components?: string[]; children?: unknown[] }
    if (n.id) levels.push({ id: n.id, label: n.label ?? '', components: [...(n.components ?? [])] })
    for (const c of n.children ?? []) walk(c)
  }
  walk(topic.levelTree)
  return { id: topic.id ?? '(未命名)', levels }
}
