/**
 * `python:literal_string` 的 **lift** 路（其中一種形狀）——**相鄰的字面接起來**。
 *
 * ```python
 * s = "abc" "def"          # 一個字串，不是兩個
 * msg = ("很長的一段"
 *        "接下去")
 * ```
 *
 * ⚠️ **混了 f-string 就不是一個字面**（`"a" f"{x}"`）——那時回 `null` 走誠實降級。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_concatenated_string', (node) => {
    const parts: string[] = []
    for (const c of node.namedChildren) {
      if (c.type !== 'string') return null
      // 只收「純字面」：有插值的那一段不是字面
      let text = ''
      let plain = true
      for (const g of c.namedChildren) {
        // ⚠️ **跳脫序列是自己一個子節點**，而它照原樣留著——
        //    還原是執行期的事（見那顆的 execute）。漏掉它的症狀是整段降級。
        if (g.type === 'string_content' || g.type === 'escape_sequence') text += g.text
        else if (g.type !== 'string_start' && g.type !== 'string_end') plain = false
      }
      if (!plain) return null
      parts.push(text)
    }
    if (parts.length < 2) return null
    const made = createNode('python:literal_string', { value: parts.join('') }, {})
    // 🔴 **語義是一個字串，而寫法是使用者的**：`"abc" "def"` 產回去要是兩段。
    //    與括號那一筆同一條線——見 `code-generator` 的 `verbatim`。
    made.metadata = { ...(made.metadata ?? {}), layoutHints: { verbatim: true } }
    return made
  })
}
