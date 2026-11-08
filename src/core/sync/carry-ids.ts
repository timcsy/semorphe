/**
 * **改程式碼之後，沒動到的節點保住身分**（spec 221；vision 286 缺口②）。
 *
 * 程式碼每次重新解析，lift 都發一批新的 id——於是改一個字，所有指著節點的東西（提議、之後的排版）都斷了。
 * 這裡把新樹對到前一棵：**對得出唯一對應的沿用舊身分，對不上的保留新身分**。不猜（P6）：
 *
 * ```
 * 元件不同                       → 不對，也不往下
 * 同一個接點                     → 先對「整棵子樹形狀相同」的（最長共同子序列，保順序）
 * 對上的之間的每一段空隙         → 兩邊數量相同、逐一同元件 ⟹ 逐一對；否則整段換新
 * ```
 *
 * 只改 `id`，不動任何形狀——程式碼、積木、執行都不受影響。
 */
import type { SemanticNode } from '../types'

const shapeKey = new WeakMap<SemanticNode, string>()
function shape(n: SemanticNode): string {
  let k = shapeKey.get(n)
  if (k === undefined) {
    const slots = Object.entries(n.slots ?? {}).map(([s, kids]) => `${s}:[${kids.map(shape).join(',')}]`).join(';')
    k = `${n.componentId}${JSON.stringify(n.properties ?? {})}{${slots}}`
    shapeKey.set(n, k)
  }
  return k
}

/** 最長共同子序列，回傳對上的索引對（保順序）。 */
function lcsPairs(a: readonly string[], b: readonly string[]): [number, number][] {
  const n = a.length, m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  }
  const out: [number, number][] = []
  let i = 0, j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push([i, j]); i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else j++
  }
  return out
}

function alignChildren(prev: readonly SemanticNode[], next: readonly SemanticNode[]): [SemanticNode, SemanticNode][] {
  const exact = lcsPairs(prev.map(shape), next.map(shape))
  const pairs: [SemanticNode, SemanticNode][] = []
  let pi = 0, ni = 0
  const gap = (pEnd: number, nEnd: number): void => {
    const ps = prev.slice(pi, pEnd), ns = next.slice(ni, nEnd)
    if (ps.length === ns.length && ps.every((p, k) => p.componentId === ns[k].componentId)) {
      ps.forEach((p, k) => pairs.push([p, ns[k]]))
    }
  }
  for (const [a, b] of exact) {
    gap(a, b)
    pairs.push([prev[a], next[b]])
    pi = a + 1
    ni = b + 1
  }
  gap(prev.length, next.length)
  return pairs
}

function carry(prev: SemanticNode, next: SemanticNode): void {
  if (prev.componentId !== next.componentId) return
  next.id = prev.id
  for (const [slot, kids] of Object.entries(next.slots ?? {})) {
    for (const [p, n] of alignChildren(prev.slots?.[slot] ?? [], kids)) carry(p, n)
  }
}

/** 就地把 `next` 裡對得上的節點改成 `prev` 的身分。 */
export function carryIds(prev: SemanticNode, next: SemanticNode): void {
  carry(prev, next)
}
