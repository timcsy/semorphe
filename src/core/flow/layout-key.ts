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
}

/** 走一遍樹，附上路徑。 */
export function walkWithPath(
  root: SemanticNode,
  lineOf: (id: string) => number | null = () => null,
): KeyedNode[] {
  const out: KeyedNode[] = []
  const walk = (n: SemanticNode, path: string): void => {
    out.push({ node: n, path, line: lineOf(n.id) })
    for (const slot of Object.keys(n.children ?? {})) {
      const kids = n.children[slot] ?? []
      kids.forEach((kid, i) => walk(kid, `${path}/${slot}[${i}]`))
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
  return [`C:${keyByContent(k)}`, `L:${keyByLine(k, sameLineIndex)}`, `P:${keyByPath(k)}`]
}

/**
 * 把「改動前的節點」對到「改動後的節點」。
 *
 * 回傳 `舊路徑 → 新節點 id`。對不到的**不在裡面**——呼叫端要看得見那件事。
 */
export function matchNodes(before: KeyedNode[], after: KeyedNode[]): Map<string, string> {
  const idxA = sameLineIndexes(before)
  const idxB = sameLineIndexes(after)
  /** 一個鍵在這一側出現幾次——出現超過一次就是曖昧，不算命中。 */
  const tally = (list: KeyedNode[], idx: number[]): Map<string, number> => {
    const m = new Map<string, number>()
    list.forEach((k, i) => allKeys(k, idx[i]).forEach((key) => m.set(key, (m.get(key) ?? 0) + 1)))
    return m
  }
  const countA = tally(before, idxA)
  const countB = tally(after, idxB)
  const byKey = new Map<string, KeyedNode>()
  after.forEach((k, i) => {
    for (const key of allKeys(k, idxB[i])) {
      if (countB.get(key) === 1) byKey.set(key, k)
    }
  })
  const out = new Map<string, string>()
  const taken = new Set<string>()
  before.forEach((k, i) => {
    for (const key of allKeys(k, idxA[i])) {
      if (countA.get(key) !== 1) continue
      const hit = byKey.get(key)
      if (!hit || taken.has(hit.node.id)) continue
      out.set(k.node.id, hit.node.id)
      taken.add(hit.node.id)
      return
    }
  })
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
