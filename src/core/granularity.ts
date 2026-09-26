/**
 * **粒度：哪幾顆現在是收起來的。**
 *
 * ## 它為什麼是共享的，不是某一個面板的
 *
 * 使用者 2026-09-26 拍板：「我的想法是 **B 對於階層式元件系統應該是一個重要功能**」。
 *
 * ```
 * 「藏起來」   一個檢視方便   —— 積木與程式碼各自的原生功能,今天就在跑
 * 🔴「粒度」   一個關於【階層的位置】—— 它屬於真實那一側,不屬於某一個面板
 * ```
 *
 * ⟹ 狀態共享（哪幾顆），而**投影三個視圖各自做**——形狀抄 `execution:at-node`
 * （一個 `nodeId` 在匯流排上，積木讓積木發光、流程讓節點發光、2D 讓元件發光，
 * `view-host.ts:270` 逐字：「**那是三個投影，不是三個命令**」）。
 *
 * 🔴 **而三個投影結構上不同**，所以本檔只算「哪幾顆」，不算「長什麼樣」：
 *
 * ```
 * 積木    摺成一行 ＋ 摘要        Blockly 原生就會
 * 程式碼  摺成一行 ＋ { … }       Monaco 的 folding 是【按行】的
 * 🔴 流程 收成一個【有埠的框】      ⟹ core/molecule.ts
 * ```
 *
 * ## 🔴 鍵不是 `nodeId`——那個坑這個專案已經掉過一次
 *
 * `core/flow/layout-key.ts` 的檔頭逐字（2026-08-27 瀏覽器實測）：
 *
 * > 節點 9 → 11｜**id 相同 0** ← 連【沒有變】的 `func_def`／`program` 都換了 id
 * > **使用者手拖十顆節點，在程式碼裡打一個字，十顆全部跳回自動排版的位置。**
 *
 * 用 `nodeId` 記收合，症狀會是**學生收起三段、在程式碼面板打一個字、三段全部展開**
 * ——同一個缺陷的第二次。
 *
 * ⟹ **持久化用鑰匙（`keysOfNodes`），執行期用 `nodeId`**，而換算走
 * `matchByKeys`——**那一份實作是共用的**，不另寫一份（那個檔自己說：另寫一份的話
 * 「編輯時對得回去、重開之後對不回去」會看起來像兩個不同的缺陷）。
 *
 * ## 本檔不回答什麼
 *
 * - **不回答「收起來長什麼樣」**——那是形態，而它是 `history/234` 點名的
 *   **抽象度**那條軸（四條軸裡刻意還沒加的那一族）。
 * - **不回答「誰可以被收」**——一塊可不可以收起來由 `core/molecule.ts` 的
 *   `boundaryOf` 判（它會拒絕散在兩處、跳過中間的選擇）。
 * - **不碰 DOM、不碰 Blockly、不碰 Monaco。**
 */
import type { SemanticNode } from './types'
import { keysOfNodes, matchByKeys, walkWithPath, type KeyedNode } from './flow/layout-key'

/** 存檔裡的一筆——**只有鑰匙**（與 `PlacedEntry` 同形，而它沒有 x／y）。 */
export interface CollapsedEntry {
  keys: string[]
}

/**
 * 存檔的鑰匙 → 這一棵樹的 `nodeId`。配不到的**安靜地掉**——那是對的：
 * 那顆節點已經不在了（使用者把那段程式刪掉了）。
 */
export function resolveCollapsed(saved: readonly CollapsedEntry[], root: SemanticNode): Set<string> {
  const after = walkWithPath(root)
  const matched = matchByKeys(saved.map((e) => e.keys), after)
  return new Set(matched.values())
}

/** `nodeId` → 存檔的鑰匙。**存檔存的是這個。** */
export function collapsedToKeys(root: SemanticNode, collapsed: ReadonlySet<string>): CollapsedEntry[] {
  const nodes = walkWithPath(root)
  const keys = keysOfNodes(nodes)
  return nodes.flatMap((k, i) => (collapsed.has(k.node.id) ? [{ keys: keys[i] }] : []))
}

/**
 * **最外層的那幾顆**——收在一個已經收起來的東西裡面的，畫面上看不到，
 * 所以投影只需要管這些。
 *
 * ⚠️ 而**裡面那幾顆不被丟掉**：使用者展開外層之後，裡層應該還是收著的。
 * 丟掉它們的症狀是「展開一層，裡面全部攤開」——那不是他要的。
 */
export function outermostCollapsed(root: SemanticNode, collapsed: ReadonlySet<string>): string[] {
  const out: string[] = []
  const walk = (n: SemanticNode, insideCollapsed: boolean): void => {
    const self = collapsed.has(n.id)
    if (self && !insideCollapsed) out.push(n.id)
    for (const kids of Object.values(n.slots ?? {})) {
      for (const k of kids ?? []) if (k) walk(k, insideCollapsed || self)
    }
  }
  walk(root, false)
  return out
}

/**
 * 被藏起來的那些——**收起來的那顆自己不算**（它還看得到，只是變成一行）。
 */
export function hiddenBy(root: SemanticNode, collapsed: ReadonlySet<string>): Set<string> {
  const hidden = new Set<string>()
  const walk = (n: SemanticNode, insideCollapsed: boolean): void => {
    if (insideCollapsed) hidden.add(n.id)
    const next = insideCollapsed || collapsed.has(n.id)
    for (const kids of Object.values(n.slots ?? {})) {
      for (const k of kids ?? []) if (k) walk(k, next)
    }
  }
  walk(root, false)
  return hidden
}

/** 掉掉不在這棵樹裡的——一次編輯之後該做的清場。 */
export function pruneCollapsed(root: SemanticNode, collapsed: ReadonlySet<string>): Set<string> {
  const alive = new Set<string>()
  const walk = (n: SemanticNode): void => {
    alive.add(n.id)
    for (const kids of Object.values(n.slots ?? {})) for (const k of kids ?? []) if (k) walk(k)
  }
  walk(root)
  return new Set([...collapsed].filter((id) => alive.has(id)))
}

/** 給投影用的一句話：這一顆現在該怎麼畫。 */
export type NodeVisibility = 'normal' | 'collapsed' | 'hidden'

export function visibilityOf(root: SemanticNode, collapsed: ReadonlySet<string>): Map<string, NodeVisibility> {
  const hidden = hiddenBy(root, collapsed)
  const m = new Map<string, NodeVisibility>()
  const walk = (n: SemanticNode): void => {
    m.set(n.id, hidden.has(n.id) ? 'hidden' : collapsed.has(n.id) ? 'collapsed' : 'normal')
    for (const kids of Object.values(n.slots ?? {})) for (const k of kids ?? []) if (k) walk(k)
  }
  walk(root)
  return m
}

export type { KeyedNode }
