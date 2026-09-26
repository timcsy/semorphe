/**
 * **選一群 → 算出邊界上有哪些埠。** 分子那一刀的前半段，而它是一個**純函式**。
 *
 * ## 它為什麼住在 `core/` 而不是積木面板裡
 *
 * 使用者 2026-09-26 拍板：「我最終希望是 **2**，就是學生可以透過這樣來做他自己的
 * 元件然後**重用或是發佈**，不過這是比較後面的事了」。
 *
 * ```
 * 共用的那一段   選一群 → 算出【哪些邊被切斷】→ 那些邊變成埠
 * ① 純整理      算完之後當成一個摺起來的框（只在這份程式裡）      ← 先做這個
 * ② 可重用      算完之後【寫成一份新宣告】＋ 進工具箱 ＋ 進存檔    ← 終點
 * ```
 *
 * > **① 不是 ② 的替代，是 ② 的前半段。**
 *
 * ⟹ 這個計算**不能做成面板的私有功能**，否則②接不上它。而那正好是
 * `flow-panel` 手拖位置那件事的**反面**：
 *
 * ```
 * 節點的位置   面板【私有】—— 第五十七條護欄守著它不進語義樹
 * 切口的埠     🔴 【真實】—— ②要把它寫進宣告
 * ```
 *
 * ⚠️ 所以本檔**零個 DOM、零個 Blockly**，而它的測試不需要面板。
 *
 * ## 🔴 它拒絕得比接受得多，而拒絕要說得出理由
 *
 * 形狀抄 `core/flow/connect.ts`（那一支的檔頭逐字：「**一個表達不出來的東西，
 * 誠實的處置是說出來，不是找個角落塞進去**」）。
 *
 * 語義樹**只有樹**，所以「一塊可以收起來的選擇」比直覺窄得多：
 *
 * ```
 * ✅ 一段【連續的兄弟】       while 裡面第 2–4 句
 * ✅ 一顆節點連它的整個子樹    一整個 for
 * ❌ 兩個不相干的地方各選一塊   —— 收起來會是【兩個】框,不是一個
 * ❌ 中間跳過一句            —— 收起來之後那一句要放哪裡？
 * ```
 *
 * ## 本檔不回答什麼
 *
 * - **不回答「那個框要長什麼樣」**——那是形態，是面板的事。
 * - **不回答「要不要存進存檔」**——①不存（它是檢視狀態），②要存。**本檔兩者都不知道**。
 * - **不判斷資料流方向**。樹上的埠只有「進來的那一個」與「出去的那些」，
 *   而 `exec` / `data` 的分別住在膠囊的 `slots` 宣告裡（`core/flow/node-graph.ts`）
 *   ——**要分色是面板去問，不是這裡先算。**
 */
import type { SemanticNode } from './types'

/** 拒絕的理由——**封閉詞彙**。加值是顯式動作（同 `RefusalReason`）。 */
export type MoleculeRefusal =
  /** 一個都沒選 */
  | 'empty'
  /** 選到了程式的根（收起來之後沒有外面） */
  | 'includes-root'
  /** 選的東西散在兩個以上的位置——收起來會是好幾個框 */
  | 'not-one-region'
  /** 同一串語句裡跳過了中間某一句 */
  | 'not-contiguous'
  /** 選了一個不在這棵樹裡的 id */
  | 'unknown-node'

/**
 * 邊界上的一個埠。
 *
 * `in` 恰好一個（收起來的那一塊從哪裡接進來）；`out` 是**被留在外面的子節點**
 * ——每一個都要有地方去，而那正是驗收那條等式數的東西。
 */
export interface MoleculePort {
  side: 'in' | 'out'
  /** 埠掛在【選區內】的哪一顆上 */
  node: string
  /** 哪一個具名位置 */
  slot: string
  /** 它在那個位置的第幾格 */
  index: number
  /** `out` 才有：被留在外面的那一顆 */
  outside?: string
}

export interface MoleculeBoundary {
  /** 入口：這一塊的父節點與它佔的那一段（`from`–`to` 含兩端） */
  entry: { parent: string; slot: string; from: number; to: number }
  ports: MoleculePort[]
}

export type MoleculeResult =
  | { ok: true; boundary: MoleculeBoundary }
  | { ok: false; reason: MoleculeRefusal }

interface Spot { parent: SemanticNode; slot: string; index: number }

function spots(root: SemanticNode): Map<string, Spot> {
  const m = new Map<string, Spot>()
  const go = (n: SemanticNode): void => {
    for (const [slot, kids] of Object.entries(n.slots ?? {})) {
      ;(kids ?? []).forEach((k, index) => {
        if (!k) return
        m.set(k.id, { parent: n, slot, index })
        go(k)
      })
    }
  }
  go(root)
  return m
}

/**
 * 算出這一組選擇的邊界。
 *
 * ⚠️ **選區是否「封閉於子孫」不是這裡的前提**：選了父而沒選子是**合法的**
 * ——那個子節點就是一個 `out` 埠（分子留一個位置給它）。
 * **那正是「埠」這個詞在這裡的意思。**
 */
export function boundaryOf(root: SemanticNode, selected: readonly string[]): MoleculeResult {
  const sel = new Set(selected)
  if (sel.size === 0) return { ok: false, reason: 'empty' }
  if (sel.has(root.id)) return { ok: false, reason: 'includes-root' }

  const where = spots(root)
  for (const id of sel) if (!where.has(id)) return { ok: false, reason: 'unknown-node' }

  // 入口：父不在選區裡的那些位置
  const outer = [...sel].map((id) => ({ id, ...where.get(id)! })).filter((s) => !sel.has(s.parent.id))
  if (outer.length === 0) return { ok: false, reason: 'not-one-region' }
  const key = (s: Spot): string => `${s.parent.id}\u0000${s.slot}`
  if (new Set(outer.map(key)).size > 1) return { ok: false, reason: 'not-one-region' }

  const idx = outer.map((s) => s.index).sort((a, b) => a - b)
  if (idx[idx.length - 1] - idx[0] + 1 !== idx.length) return { ok: false, reason: 'not-contiguous' }

  const ports: MoleculePort[] = []
  for (const s of outer) {
    ports.push({ side: 'in', node: s.id, slot: s.slot, index: s.index })
  }
  // 出口：選區內的節點，它的子節點不在選區裡
  for (const id of sel) {
    const n = findNode(root, id)
    if (!n) continue
    for (const [slot, kids] of Object.entries(n.slots ?? {})) {
      ;(kids ?? []).forEach((k, index) => {
        if (k && !sel.has(k.id)) ports.push({ side: 'out', node: id, slot, index, outside: k.id })
      })
    }
  }
  return {
    ok: true,
    boundary: { entry: { parent: outer[0].parent.id, slot: outer[0].slot, from: idx[0], to: idx[idx.length - 1] }, ports },
  }
}

function findNode(root: SemanticNode, id: string): SemanticNode | null {
  if (root.id === id) return root
  for (const kids of Object.values(root.slots ?? {})) {
    for (const k of kids ?? []) {
      const hit = k && findNode(k, id)
      if (hit) return hit
    }
  }
  return null
}

/**
 * 驗收那條等式的左邊：**切之前有幾條線跨過邊界**。
 *
 * 🔴 **它刻意獨立算一次，不是從 `boundaryOf` 的結果數**
 * ——否則等式的兩邊來自同一段程式碼，而那種等式恆真。
 */
export function crossingEdges(root: SemanticNode, selected: readonly string[]): number {
  const sel = new Set(selected)
  let n = 0
  const go = (node: SemanticNode): void => {
    for (const kids of Object.values(node.slots ?? {})) {
      for (const k of kids ?? []) {
        if (!k) continue
        if (sel.has(node.id) !== sel.has(k.id)) n++
        go(k)
      }
    }
  }
  go(root)
  return n
}
