/**
 * **手拖的佈局記在哪一把鑰匙上**。
 *
 * ## 為什麼不能用 `nodeId`（2026-08-27 量出來的）
 *
 * 路線圖把這件事寫成一個開放問句（`vision.md`「**nodeId 穩不穩定**——不穩就對不回去」）。
 * 答案是**完全不穩**：`semantic-tree.ts` 的 `generateId()` 是
 * `node_${++idCounter}_${Date.now().toString(36)}`——計數器與時戳兩個都會變。
 *
 * 瀏覽器實測（改一行不相干的程式碼再同步一次）：
 *
 * ```
 * 節點      9 → 11
 * id 相同    0        ← 連【沒有變】的 func_def／program 都換了 id
 * ```
 *
 * 🔴 **而這不只是「還沒持久化」——它今天就在掉東西**：面板的 `rebuild()`
 * 會把不在新樹裡的位移刪掉，而重新解析之後沒有一個 id 還在。
 *
 * > **使用者手拖十顆節點，在程式碼裡打一個字，十顆全部跳回自動排版的位置。**
 *
 * ## 三個候選，而它們的差別只有在【已知答案的樣本】上看得出來
 *
 * `experience.md:401` 逐字：「**判準本身可以是對的，把它自動化的第一版仍然會量錯。**
 * 靜態判斷要先在已知答案的樣本上驗過再拿來下結論。」
 *
 * → 所以這個檔**同時匯出三個**，由 `tests/integration/audit-layout-key.test.ts`
 * 在三種改動上量它們，量完才挑。**挑哪一個寫在那支測試的報表裡，不寫在這裡。**
 *
 * ⚠️ `build-guardrail` §11 逐字：「**鍵不要用行號——它報的不是違規，是 diff**」。
 * 候選 B 正踩在那句話上，所以它的第一道閘就是「在前面加一行」。
 */
import type { SemanticNode } from '../types'

/** 一顆節點在樹裡的位置 ＋ 它自己。 */
export interface KeyedNode {
  node: SemanticNode
  /** 從根走到它的路徑，例如 `body[0]/params[1]`。 */
  path: string
  /** 它在程式碼裡的起始行（沒有對應就是 `null`）。 */
  line: number | null
  /** 父節點（根沒有）——上下文鍵要它（第 191 刀） */
  parent?: SemanticNode
}

/** 走一遍樹，附上路徑。 */
export function walkWithPath(
  root: SemanticNode,
  lineOf: (id: string) => number | null = () => null,
): KeyedNode[] {
  const out: KeyedNode[] = []
  const walk = (n: SemanticNode, path: string, parent?: SemanticNode): void => {
    out.push({ node: n, path, line: lineOf(n.id), ...(parent ? { parent } : {}) })
    for (const slot of Object.keys(n.slots ?? {})) {
      const kids = n.slots[slot] ?? []
      kids.forEach((kid, i) => walk(kid, `${path}/${slot}[${i}]`, n))
    }
  }
  walk(root, '')
  return out
}

/**
 * **候選 A：結構路徑**——`cpp:if@/body[2]/condition[0]`。
 *
 * 撐得住「改一個值」與「在後面加一行」；⚠️ 「在中間插一個兄弟」會讓**後面整串位移**
 * ——那與 `build-guardrail` §11 的行號是同一個病，只是換了一個座標系。
 */
export function keyByPath(k: KeyedNode): string {
  return `${k.node.componentId}@${k.path}`
}

/**
 * **候選 B：程式碼位置**——`cpp:if@L3`。
 *
 * ⚠️ 同一行上可能有好幾顆（`x = a + b` 有四顆），所以要**加序號**：
 * 同一行同一種身分的第 n 顆。
 */
export function keyByLine(k: KeyedNode, sameLineIndex: number): string {
  return k.line === null ? `${k.node.componentId}@?` : `${k.node.componentId}@L${k.line}#${sameLineIndex}`
}

/**
 * **候選 C：內容**——認的是「這顆長什麼樣」，**與它在哪裡無關**。
 *
 * 🔴 第一版把**父路徑**也編進去了，於是它跟著候選 A 一起壞
 * ——2026-08-27 實測抓到：`return 0;` 那顆 `0` 三把鑰匙**全掉**，
 * 因為插一行讓 `return` 從 `body[3]` 變成 `body[4]`，
 * 而那同時改了它的路徑鍵、行號鍵、**以及內容鍵**。
 *
 * > **三把鑰匙的價值在於失效條件互斥。把其中一把的條件抄進另一把，
 * > 就等於少了一把。**
 *
 * ⚠️ 拿掉父路徑之後它會**變得容易撞**（`int x = 1` 與 `int y = 1` 的
 * 兩個 `1` 長得一樣）——而那沒關係：撞到的鍵一律不算命中
 * （`matchNodes` 只收「兩邊都只出現一次」的鍵）。
 * **寧可對不回去，不要對到別人身上。**
 */
export function keyByContent(k: KeyedNode): string {
  const props = Object.entries(k.node.properties ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([a, b]) => `${a}=${String(b)}`)
    .join(',')
  return `${k.node.componentId}{${props}}`
}

/**
 * **候選 D：三把一起用，任一命中就算數**。
 *
 * 🔴 它不是「把三個爛的加起來」——三者掉的是**不同的那幾顆**：
 *
 * ```
 * 在後面加一行     路徑掉「後面那些兄弟」（索引位移）
 *                 行號掉「行號變了的那些」
 *                 內容【不掉】
 * 改一個值         內容掉那一顆
 *                 路徑與行號【不掉】
 * ```
 *
 * > **三把鑰匙的失效條件互斥，所以聯集比任何一把都好——
 * > 而那是量出來的，不是推出來的。**
 *
 * ⚠️ 代價：一顆節點有三個鍵，而**兩顆不同的節點可能共用其中一個**。
 * 所以配對要求**那個鍵在兩邊都只出現一次**——曖昧的鍵一律不算命中
 * （`build-guardrail`：判不出來就說判不出來，且不計入安全）。
 */
export function allKeys(k: KeyedNode, sameLineIndex: number): string[] {
  // 🔴 **順序是「最不容易錯的先試」，而它不是我第一版寫的順序**（2026-08-27）。
  //
  // 第一版是 路徑 → 行號 → 內容，而路徑**正是最脆的那一把**：
  // 在前面插一個兄弟之後，舊的 `body[0]` 與**新插進來的那顆**同路徑，
  // 於是舊節點的佈局被指給了新節點。
  //
  // > **一把先被試的脆鑰匙，不只是「配不到」——它會配到別人身上，
  // > 而那比配不到更糟。**
  //
  // ⚠️ 抓到它的是單元測試，**不是瀏覽器**：畫面上那些座標字串照樣都在，
  //    只是掛在錯的節點上——「保住 9/9」在錯誤配對下**也會成立**。
  //    （`build-guardrail` §8：一個因為錯誤理由而給出正確結果的檢查，
  //     看起來與健康的完全一樣。）
  //
  // 內容（我是誰）→ 行號（我在第幾行）→ 路徑（我排第幾個）。
  // 🔴 **最前面多一把子樹鍵**（2026-11-01，第 191 刀）——見 `subtreeKey`。
  return [subtreeKey(k.node), ...(k.parent ? [contextKey(k)] : []), `C:${keyByContent(k)}`, `L:${keyByLine(k, sameLineIndex)}`, `P:${keyByPath(k)}`]
}

/**
 * **子樹鍵**——這一顆連同它裡面的全部長什麼樣（身分＋屬性，遞迴），雜湊成一把。
 *
 * 🔴 為什麼要它（2026-11-01 量到）：在程式**最前面**加一行（補一個 `#include`），行號鍵與路徑鍵**全部位移一格**，
 *    而 `cout`、`endl` 這類節點自己的內容鍵又到處重複——於是舊的 `L:` 指到【新樹裡那一行上的別顆】。
 *    課文語料逐顆量：對 1301｜掉 1163｜**對到別顆 758**——手拖的位置掛到隔壁的節點上。
 *    子樹分得出「`return a + b` 與 `return a * b`」，而位移不改變它。
 * ⚠️ 它也是**驗證**：行號／路徑／內容命中時，若那一塊原本的長相仍在新樹裡、而命中的那顆長得不一樣 ⟹ 是位移造成的錯配，不收。
 */
export function subtreeKey(n: SemanticNode): string {
  return `S:${fnv(shapeOf(n))}`
}

/**
 * **上下文鍵**——父節點的子樹 ＋ 我在父節點裡的位置（`slot[i]`）。
 * 子樹鍵分不開「長得一模一樣的雙胞胎」（兩個 `endl`）；它們的父節點（`cout << "a" << endl` 與 `cout << "b" << endl`）分得開。
 */
export function contextKey(k: KeyedNode): string {
  const last = k.path.slice(k.path.lastIndexOf('/') + 1)
  return `X:${fnv(shapeOf(k.parent!))}/${last}`
}

function shapeOf(n: SemanticNode): string {
  const props = Object.entries(n.properties ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([a, b]) => `${a}=${String(b)}`).join(',')
  const slots = Object.keys(n.slots ?? {}).sort().map((s) => `${s}[${(n.slots[s] ?? []).map((k) => (k ? shapeOf(k) : '_')).join(';')}]`).join('')
  return `${n.componentId}{${props}}${slots}`
}

/** FNV-1a（32 位元）——存檔裡放雜湊不放整串 */
function fnv(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(36)
}

/**
 * 存檔裡的一筆手放過的位置。
 *
 * 🔴 `keys` 是那顆節點的三把鑰匙，**不是 `nodeId`**——id 重開之後一個都不會留。
 */
export interface PlacedEntry {
  keys: string[]
  x: number
  y: number
}

/** 一批節點各自的三把鑰匙——**存檔存的就是這個**（不是 `nodeId`，它重開就變了）。 */
export function keysOfNodes(nodes: KeyedNode[]): string[][] {
  const idx = sameLineIndexes(nodes)
  return nodes.map((k, i) => allKeys(k, idx[i]))
}

/**
 * **用鑰匙去配**——`before` 只給鑰匙，不給節點。
 *
 * 🔴 它是 `matchNodes` 與**存檔還原**共用的那一份實作。
 * 存檔那條路手上沒有舊節點（只有存下來的鑰匙），而如果為它另寫一份配對，
 * 兩份的「曖昧怎麼算」遲早會分岔——而分岔的症狀是
 * 「編輯時對得回去，重開之後對不回去」，看起來像**兩個不同的缺陷**。
 *
 * 回傳 `before 的索引 → after 的節點 id`。配不到的**不在裡面**。
 */
export function matchByKeys(before: string[][], after: KeyedNode[]): Map<number, string> {
  const afterKeys = keysOfNodes(after)
  const tally = (lists: string[][]): Map<string, number> => {
    const m = new Map<string, number>()
    for (const keys of lists) for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1)
    return m
  }
  const countA = tally(before)
  const countB = tally(afterKeys)
  const byKey = new Map<string, KeyedNode>()
  after.forEach((k, i) => {
    for (const key of afterKeys[i]) if (countB.get(key) === 1) byKey.set(key, k)
  })
  const out = new Map<number, string>()
  const taken = new Set<string>()
  const subtreeOf = new Map<string, string>()
  const contextOf = new Map<string, string>()
  after.forEach((k, i) => {
    const sk = afterKeys[i].find((x) => x.startsWith('S:'))
    if (sk) subtreeOf.set(k.node.id, sk)
    const xk = afterKeys[i].find((x) => x.startsWith('X:'))
    if (xk) contextOf.set(k.node.id, xk)
  })
  before.forEach((keys, i) => {
    const mine = keys.find((x) => x.startsWith('S:'))
    const ctx = keys.find((x) => x.startsWith('X:'))
    for (const key of keys) {
      // ⚠️ 曖昧的鍵一律不算命中——**寧可對不回去，不要對到別人身上**。
      if (countA.get(key) !== 1) continue
      const hit = byKey.get(key)
      if (!hit || taken.has(hit.node.id)) continue
      // 🔴 位移造成的錯配（見 `subtreeKey`）：我原本的長相還在新樹裡，而命中的這顆長得不一樣 ⟹ 不收
      if (mine && !key.startsWith('S:') && (countB.get(mine) ?? 0) > 0 && subtreeOf.get(hit.node.id) !== mine) continue
      // 雙胞胎（子樹一樣）：我原本的上下文還在新樹裡，而命中的這顆上下文不同 ⟹ 是位移指到了另一個雙胞胎，不收
      if (ctx && !key.startsWith('S:') && !key.startsWith('X:') && (countB.get(ctx) ?? 0) > 0 && contextOf.get(hit.node.id) !== ctx) continue
      out.set(i, hit.node.id)
      taken.add(hit.node.id)
      return
    }
  })
  followParents(before, after, out)
  return out
}

/**
 * **子節點跟著父節點走**（第 191 刀）——由淺到深：父節點對到了哪一顆，子節點就是那一顆的同一個位置（同身分才算）。
 *
 * 🔴 為什麼要它：三句一模一樣的 `pay += pay / 10;`，句子本身靠上下文鍵分得開（`main` 的第幾句），
 *    而句子**裡面**的 `pay`、`/`、`10` 是三胞胎——連上下文都一樣，位移之後行號鍵指到隔壁那句的那一顆。
 *    結構上它們的歸屬是確定的：跟著父節點。
 * ⚠️ 只在「父節點也在這一批裡、對到了、而且它的子樹一模一樣」時才動——存檔還原時只存手放過的那幾顆，父節點多半不在，照舊。
 */
function followParents(before: string[][], after: KeyedNode[], out: Map<number, string>): void {
  const pathOf = (keys: string[]): { comp: string; path: string } | null => {
    const p = keys.find((k) => k.startsWith('P:'))
    if (!p) return null
    const at = p.indexOf('@')
    return { comp: p.slice(2, at), path: p.slice(at + 1) }
  }
  const entries = before.map(pathOf)
  const entryAt = new Map<string, number>()
  entries.forEach((e, i) => { if (e) entryAt.set(e.path, i) })
  const nodeAt = new Map(after.map((k) => [k.path, k]))
  const pathOfId = new Map(after.map((k) => [k.node.id, k.path]))
  const order = entries.map((e, i) => [e ? e.path.split('/').length : 0, i] as const).sort((x, y) => x[0] - y[0]).map(([, i]) => i)
  const owner = new Map<string, number>()
  for (const [i, id] of out) owner.set(id, i)
  for (const i of order) {
    const e = entries[i]
    if (!e || e.path === '') continue
    const cut = e.path.lastIndexOf('/')
    const pi = entryAt.get(e.path.slice(0, cut))
    const pid = pi === undefined ? undefined : out.get(pi)
    if (pid === undefined) continue
    // 🔴 父節點的子樹【一模一樣】才跟——裡面沒變，位置才一一對應。
    //    根節點在最前面插一行之後子樹變了，它的孩子（頂層的 #include、函式）不能照索引跟（量到過：錯從 21 升到 56）
    const parentShape = before[pi!].find((k) => k.startsWith('S:'))
    const parentNode = nodeAt.get(pathOfId.get(pid)!)
    if (!parentShape || !parentNode || subtreeKey(parentNode.node) !== parentShape) continue
    const cand = nodeAt.get(`${pathOfId.get(pid)}${e.path.slice(cut)}`)
    if (!cand || cand.node.componentId !== e.comp) continue
    const prev = owner.get(cand.node.id)
    if (prev !== undefined && prev !== i) out.delete(prev)
    const mineBefore = out.get(i)
    if (mineBefore !== undefined) owner.delete(mineBefore)
    out.set(i, cand.node.id)
    owner.set(cand.node.id, i)
  }
}

/**
 * 把「改動前的節點」對到「改動後的節點」。
 *
 * 回傳 `舊 id → 新 id`。對不到的**不在裡面**——呼叫端要看得見那件事。
 */
export function matchNodes(before: KeyedNode[], after: KeyedNode[]): Map<string, string> {
  const byIndex = matchByKeys(keysOfNodes(before), after)
  const out = new Map<string, string>()
  for (const [i, newId] of byIndex) out.set(before[i].node.id, newId)
  return out
}

/** 把同一行同一身分的順序算出來（候選 B 要）。 */
export function sameLineIndexes(nodes: KeyedNode[]): number[] {
  const seen = new Map<string, number>()
  return nodes.map((k) => {
    const bucket = `${k.node.componentId}@${k.line}`
    const n = seen.get(bucket) ?? 0
    seen.set(bucket, n + 1)
    return n
  })
}
