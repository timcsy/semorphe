/**
 * `cpp:literal_string` 的 **lift** 路（其中一種形狀）——**相鄰的字面接起來**。
 *
 * ```cpp
 * const char* s = "ab" "cd";          // 一個字串，不是兩個
 * cout << "很長的一段"
 *         "接下去";
 * ```
 *
 * 🔴 **語義是一個字串，而寫法是使用者的**：`layoutHints.verbatim` 讓產生那一路
 * 照原文印回去——與 Python 那側同一條線（見那顆的 `lift-strategy.ts`）。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('cpp:lift_concatenated_string', (node) => {
    const parts: string[] = []
    for (const c of node.namedChildren) {
      if (c.type !== 'string_literal') return null
      parts.push(c.text.slice(1, -1))
    }
    if (parts.length < 2) return null
    const made = createNode('cpp:literal_string', { value: parts.join('') }, {})
    made.metadata = {
      ...(made.metadata ?? {}),
      rawCode: node.text,
      layoutHints: { verbatim: true },
    }
    return made
  })
}
