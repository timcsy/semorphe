import type { BlockSpecRegistry } from '../core/block-spec-registry'
import type { BlockSpec, ToolboxCategoryDef } from '../core/types'
import { KNOWN_AXES } from '../core/projection/form-selection'
import { ioTraitOf } from '../core/component/traits'

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

/**
 * 這一顆是不是「軸值取不到時的退路」？
 *
 * 是 → 它不是學生選得出來的選項，不進工具箱。
 * 判準是**兄弟形態所在那條軸的 `from`**：只有 `property`（要去查型別）
 * 才需要退路；`position` 永遠取得到，所以那條軸上沒宣告 `form` 的是敘述版。
 */
export function isTypeLookupFallback(registry: BlockSpecRegistry, spec: BlockSpec): boolean {
  if (spec.form) return false
  const cid = spec.componentMapping?.componentId
  if (!cid) return false
  const siblings = registry.getFormsByConceptId(cid).filter(s => s.form)
  if (siblings.length === 0) return false
  return siblings.some(s => KNOWN_AXES[s.form!.axis]?.from === 'property')
}

/**
 * 組工具箱：**段落的順序是宣告的，段落的成員是導出的。**
 *
 * 在此之前這裡是「登錄分類拉一批 ＋ 80 筆手寫積木型別」。手寫的那半直接違反
 * P3（「不修改既有程式碼的前提下加入新概念」）——加一顆元件要來這裡登記，
 * 而**忘了登記的下場是使用者拿不到它**，實測有 7 顆。
 *
 * 現在一顆積木出現在工具箱裡，只因為它被宣告在某個模組的 `blocks.json` 裡。
 */
export function buildToolbox(config: ToolboxBuildConfig): object {
  const { blockSpecRegistry, visibleConcepts, ioPreference: ioPref, msgs, categoryColors, categoryDefs = [] } = config

  const isVisible = (blockType: string): boolean =>
    blockSpecRegistry.isBlockVisible(blockType, visibleConcepts)

  /**
   * 一個段落裡**屬於這個工具箱分類**的積木型別，維持宣告順序。
   *
   * 兩道過濾，兩者都是**推導**的，不是清單：
   *
   * 1. **中性形態不進工具箱**（TB-3）——它是軸值取不到時的退路，
   *    不是學生選得出來的選項（097）。
   *
   *    ⚠️ **「沒有宣告 `form`」在兩條軸上意思不一樣**，這裡踩過一次：
   *
   *    | 軸 | `from` | 沒宣告 form 的那一顆是 |
   *    |---|---|---|
   *    | `container_kind` | `property` | **退路**——型別查不到時才用它 |
   *    | `role` | `position` | **敘述版**——一個真正的選項 |
   *
   *    位置永遠知道（它是結構性的），所以 `role` 軸**不需要退路**；
   *    把它一律當退路排掉，會讓 `cpp_var_declare`／`cpp_input`／`cpp_func_call`
   *    等七顆敘述版積木從工具箱裡消失——而它們是最常用的那幾顆。
   *
   *    所以判準是**軸的 `from`**，不是「有沒有 form」。
   *
   * 2. **逐顆宣告的歸屬優先**——`<cstdlib>` 的六顆散進運算／控制／文字三個
   *    分類，那是三個不同的教學意圖，來源決定不了。
   */
  const sourceBlocks = (from: string, category: string, targetKey: string): string[] =>
    blockSpecRegistry
      .listBySource(from, category, visibleConcepts)
      .filter(s => {
        if (isTypeLookupFallback(blockSpecRegistry, s)) return false
        const declared = s.toolboxCategory
        if (declared === undefined) return true
        return Array.isArray(declared) ? declared.includes(targetKey) : declared === targetKey
      })
      .map(s => (s.blockDef as Record<string, unknown>)?.type as string | undefined)
      .filter((t): t is string => Boolean(t) && isVisible(t!))

  const buildIoContents = (def: ToolboxCategoryDef): ToolboxEntry[] => {
    if (def.buildContents) {
      return def.buildContents(blockSpecRegistry, visibleConcepts, ioPref)
    }
    const ioTypes = def.sources.flatMap(src => sourceBlocks(src.from, src.category, def.key))

    // ⚠️ **分成兩堆時，第二堆要是「其餘」，不是另一個前綴。**
    //
    // 這裡原本寫 `filter(t => t.startsWith('c_'))`，於是 `cpp_input_line`、
    // `cpp_ifstream_declare`、`cpp_ofstream_declare` 三顆**兩邊都不屬於**，
    // 被這個排序函式**靜靜地丟掉**——它們的 `category` 明明就是 `'io'`。
    //
    // 那不是「忘了加進清單」，是**宣告是對的，而呈現層把它吃掉了**。
    // 症狀完全一樣（使用者拿不到），根因差很遠。
    //
    // ⚠️ **而第二版仍然是拿形狀當判斷**：`startsWith('u_')`。
    // 116 把積木型別改成從身分導出之後**沒有型別以 `u_` 開頭**，
    // 於是 `universalIo` 恆為空、排序偏好靜靜失效——同一個病的第二次。
    //
    // > **命名慣例不是契約。** 要判斷「這顆概念是不是通用的」，就問宣告。
    //
    // ⚠️ **第三版：連「問宣告」都問錯了問題**（2026-08-11）。
    //
    // 第三版問的是 `layer === 'universal'`——而這裡真正要的是
    // 「**這顆是不是使用者偏好的那個 I/O 風格**」。`layer` 只是**碰巧**對：
    // `cpp:print` 剛好標 universal、`cpp:print_formatted` 剛好標 lang-core。
    //
    // > **一個代理答對了，不代表它答的是同一個問題。**
    // > 前兩版的代理是「名字長什麼樣」，第三版是「它被分在哪一層」——
    // > 三次都是拿一個相關的東西去回答一個它不負責的問題。
    //
    // 第四版問的是那條**等價邊**本身：`cpp:print` 與 `cpp:print_formatted`
    // 宣告了同一個 `ioRole`（＝同一個等價類）與不同的 `ioStyle`（＝哪個成員）。
    // 「先給學生看哪一顆」＝ **在教學這個情境下，等價類的代表元是誰**。
    // 見 `concepts/等價與觀察集.md` §六與 `concepts/性狀.md`。
    //
    // ⚠️ **行為有一處刻意改變**：`ioPref = 'cstdio'` 時，原本是
    // 「**全部** lang 的（含 getline、fstream）排前面」，現在是
    // 「**cstdio 風格的那兩顆**排前面，其餘照原序」。
    // 舊行為把「風格偏好」與「分層」混在一起，而 getline／fstream
    // **沒有風格對立面**——它們不該因為使用者選了 printf 就往前跳。
    const style = (t: string): string | undefined => {
      const cid = blockSpecRegistry.getByBlockType(t)?.componentMapping?.componentId
      return cid ? ioTraitOf(cid)?.style : undefined
    }
    // 三堆而不是兩堆——**「其餘」要是扣除式的**（見上面第一版的病歷）。
    const matchesPref = ioTypes.filter(t => style(t) === ioPref)
    const rest = ioTypes.filter(t => style(t) !== ioPref)
    return [...matchesPref, ...rest].map(t => ({ kind: 'block', type: t }))
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

    const excludeSet = new Set(def.excludeTypes ?? [])

    // 帶 `extraState` 的入口：同一顆積木用不同的預設狀態出現數次。
    // 那是教學設計（「有 else 的 if 值得一個獨立入口」），登錄表推不出來，
    // 所以它**留著**，並在該積木出現的位置就地展開。
    const stateEntries = new Map<string, ToolboxEntry[]>()
    for (const t of def.extraTypes ?? []) {
      if (typeof t === 'string') {
        throw new Error(
          `工具箱分類 '${def.key}' 的 extraTypes 仍有純字串項目 '${t}'。` +
            `純字串代表「這顆積木屬於這個分類」——**登錄表知道**，請改用 sources 導出。` +
            `extraTypes 只保留帶 extraState 的入口。`,
        )
      }
      if (!isVisible(t.type)) continue
      const list = stateEntries.get(t.type) ?? []
      list.push({ kind: 'block', type: t.type, ...(t.extraState ? { extraState: t.extraState } : {}) })
      stateEntries.set(t.type, list)
    }

    const contents: ToolboxEntry[] = []
    const seen = new Set<string>()
    for (const src of def.sources) {
      for (const t of sourceBlocks(src.from, src.category, def.key)) {
        if (excludeSet.has(t) || seen.has(t)) continue
        seen.add(t)
        const withState = stateEntries.get(t)
        if (withState) contents.push(...withState)
        else contents.push({ kind: 'block', type: t })
      }
    }

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
