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
import type { SemanticBus } from './sync/semantic-bus'
import { contextKey, keysOfNodes, keyByPath, matchByKeys, subtreeKey, walkWithPath, type KeyedNode } from './flow/layout-key'

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
  const subtreeKeys = after.map((k) => subtreeKey(k.node))
  const count = new Map<string, number>()
  for (const sk of subtreeKeys) count.set(sk, (count.get(sk) ?? 0) + 1)
  const out = new Set<string>()
  const legacy: string[][] = []
  for (const e of saved) {
    const sk = e.keys.find((k) => k.startsWith('S:'))
    // v25 第一版的存檔沒有子樹鍵——照舊的配對（spec 188 交付的那幾天存下的）
    if (!sk) { legacy.push(e.keys); continue }
    const hits = after.flatMap((k, i) => (subtreeKeys[i] === sk ? [k] : []))
    const pathHit = (k: KeyedNode): boolean => e.keys.includes(`P:${keyByPath(k)}`)
    let pick: KeyedNode | undefined
    if (hits.length === 1) pick = hits[0]
    // 同樣內容的有好幾顆（兩個一模一樣的迴圈）→ 由路徑挑；挑不出就不對（寧可對不回去）
    else if (hits.length > 1) {
      // 先用上下文鍵（父節點的子樹＋位置）分開雙胞胎，再用路徑（第 191 刀）
      const ctxHit = (k: KeyedNode): boolean => !!k.parent && e.keys.includes(contextKey(k))
      const byCtx = hits.filter(ctxHit)
      pick = byCtx.length === 1 ? byCtx[0] : hits.filter(pathHit).length === 1 ? hits.find(pathHit) : undefined
    }
    // 一顆都沒有＝收起來的那一段裡面被改了 → 才退回路徑（同一個身分、同一個位置）
    else pick = after.find(pathHit)
    if (pick && !out.has(pick.node.id)) out.add(pick.node.id)
  }
  if (legacy.length > 0) for (const id of matchByKeys(legacy, after).values()) out.add(id)
  return out
}

// 子樹鍵（spec 190）住在 `flow/layout-key.ts` 的 `subtreeKey`——第 191 刀把它搬過去，手拖位置與收合共用一份。
// 🔴 為什麼收合需要它：`matchByKeys` 判「這把鑰匙曖昧嗎」是數**存下來的那一批**；收合只存收著的那幾顆，
//    每一把鑰匙在那一批裡都「唯一」——護欄 `audit-collapse-roundtrip` 量到 `mul` 的 `return` 對到 `add` 的 `return`。

/** `nodeId` → 存檔的鑰匙。**存檔存的是這個。** */
export function collapsedToKeys(root: SemanticNode, collapsed: ReadonlySet<string>): CollapsedEntry[] {
  const nodes = walkWithPath(root)
  const keys = keysOfNodes(nodes)
  // `keysOfNodes` 已經帶子樹鍵（第 191 刀起）
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

/**
 * **共享的那一份**（spec 187）——誰收著，以鑰匙記。
 *
 * 🔴 每一次語義更新都要 `refresh`：`nodeId` 全換了，而鑰匙要跟著換成這一棵的
 * ——否則連改幾次之後鑰匙與樹漸行漸遠，有一天突然對不回去。
 */
export class GranularityState {
  private entries: CollapsedEntry[] = []
  private root: SemanticNode | null = null

  /** 對到這一棵樹、換成這一棵的鑰匙；回傳收著的 `nodeId`。 */
  refresh(root: SemanticNode): Set<string> {
    this.root = root
    const ids = resolveCollapsed(this.entries, root)
    this.entries = collapsedToKeys(root, ids)
    return ids
  }

  /** 收合或展開一顆（`nodeId` 是**上一次 `refresh` 那棵樹**的）。回傳有沒有變。 */
  set(nodeId: string, collapsed: boolean): boolean {
    if (!this.root) return false
    const ids = resolveCollapsed(this.entries, this.root)
    if (ids.has(nodeId) === collapsed) return false
    if (collapsed) ids.add(nodeId)
    else ids.delete(nodeId)
    const next = collapsedToKeys(this.root, ids)
    // 配不到這棵樹上（不是這棵樹的 id）→ 什麼都沒變
    if (collapsed && next.length === this.entries.length) return false
    this.entries = next
    return true
  }

  /** 從存檔還原（spec 188）——鑰匙先放著，下一次 `refresh` 對到樹上。 */
  load(entries: readonly CollapsedEntry[]): void {
    this.entries = entries.map((e) => ({ keys: [...e.keys] }))
  }

  list(): CollapsedEntry[] {
    return this.entries.map((e) => ({ keys: [...e.keys] }))
  }
}

/**
 * 接上匯流排：收請求、跟著每一次語義更新換鑰匙、廣播給視圖。
 * ⚠️ 要在 `connectViews` **之前**接——同一次 `semantic:update`，持有者要先換好鑰匙。
 */
export function connectGranularity(bus: SemanticBus, state = new GranularityState()): GranularityState {
  // 換好鑰匙後再廣播一次——視圖手上的鑰匙才會跟著這一棵（它們隨後收到同一次 semantic:update，用新鑰匙對回）
  bus.on('semantic:update', (d) => {
    const before = state.list().length
    state.refresh(d.tree)
    if (before > 0) bus.emit('granularity:collapsed', { entries: state.list() })
  })
  bus.on('granularity:request', (d) => {
    if (state.set(d.nodeId, d.collapsed)) bus.emit('granularity:collapsed', { entries: state.list() })
  })
  return state
}

export type { KeyedNode }
