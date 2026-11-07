/**
 * **執行覆蓋：哪些節點算「跑過了」**。
 *
 * 判決提供者的執行紀錄記的是**它自己的敘述**，而一句語意樹的語句不一定是它的一句：
 * `int a = 7, b = 3;` 在 Cella 那邊是兩句宣告、各用宣告子自己的節點 id——外層那句的 id 從來不會出現。
 * 症狀：最簡單的程式跑完也說「有 1 塊積木這一次沒有被跑到」（2026-11-07，334 的瀏覽器驗收抓到；main 上就有）。
 *
 * 規則：一顆節點的**非語句槽**（宣告子、條件、運算式）裡有東西跑過 ⟹ 它自己也跑過了——
 * 那些子節點只在它執行時才會被走到。
 * ⚠️ 語句槽（本體）不往上推：父語句自己會出現在紀錄裡（迴圈、`if` 都是 Cella 的一句），不需要靠本體證明；
 *    而只推非語句槽，就不會把「`if` 的另一支沒跑到」這種該問的情況蓋掉。
 */
import type { SemanticNode } from './types'
import { bodySlotsOf } from './component/traits'

export function withRanByParts(tree: SemanticNode | null | undefined, visited: Iterable<string>): Set<string> {
  const out = new Set(visited)
  if (!tree) return out
  const walk = (n: SemanticNode): boolean => {
    const bodies = new Set(bodySlotsOf(n.componentId))
    let partRan = false
    for (const [slot, kids] of Object.entries(n.slots ?? {})) {
      for (const k of kids) {
        const ran = walk(k)
        if (ran && !bodies.has(slot)) partRan = true
      }
    }
    if (partRan) out.add(n.id)
    return out.has(n.id)
  }
  walk(tree)
  return out
}
