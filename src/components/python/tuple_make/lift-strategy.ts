/**
 * `python:tuple_make` 的 **lift** 路——兩個節點型別，一顆元件。
 *
 * ```
 * (3, 4)     tuple             有括號
 * 1, 2       expression_list   沒有括號 —— `a, b = 1, 2`、`return x, y`
 * ```
 *
 * ## 🔴 括號是排版，不是語義——而投影要記住它
 *
 * 兩種寫法**語義完全相同**，所以是同一顆元件。而如果產回去一律加括號，
 * `a, b = 1, 2` 會變成 `a, b = (1, 2)`：**意思沒變，而使用者的碼被改了**。
 *
 * 這個專案對這件事有既定的做法（空行那一刀的同一句話）：
 *
 * > **投影記住它，積木看不到它。**
 *
 * 所以「有沒有括號」放在 `metadata`——它不是屬性（積木上沒有這一格、
 * 學生不必知道），而產生器讀得到。
 *
 * ⚠️ 而使用者在積木那側改過之後 metadata 會不在，那時產出帶括號的版本
 * ——**仍然正確**，只是排版換了。那是可以接受的：**排版的遺失不是語義的遺失**。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:liftTuple', (node, ctx) => {
    const items = node.namedChildren
      .map((c) => ctx.lift(c))
      .filter((n): n is SemanticNode => n !== null)
    const made = createNode('python:tuple_make', {}, { items })
    // `tuple` 節點自帶括號；`expression_list` 沒有。
    made.metadata = { ...(made.metadata ?? {}), layoutHints: { bareTuple: node.type === 'expression_list' } }
    return made
  })
}
