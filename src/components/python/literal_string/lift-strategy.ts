/**
 * `python:literal_string` 的 **lift** 路——單一個字串，以及**相鄰的字面接起來**。
 *
 * ```python
 * s = "abc" "def"          # 一個字串，不是兩個
 * msg = ("很長的一段"
 *        "接下去")
 * ```
 *
 * ⚠️ **混了 f-string 就不是一個字面**（`"a" f"{x}"`）——那時回 `null` 走誠實降級。
 */
import type { AstNode as Node } from '../../../core/lift/types'
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'
import { bodyOf, parseStart } from './body'

/** 一個純字面的 `string` 節點 → `value`；有插值、是 bytes 就回 `null`。 */
function plainBody(node: Node): string | null {
  const startNode = node.namedChildren.find((c) => c.type === 'string_start')
  const start = parseStart(startNode?.text ?? '"')
  if (start.bytes) return null
  let text = ''
  for (const g of node.namedChildren) {
    if (g.type === 'string_start' || g.type === 'string_end') continue
    if (g.type !== 'string_content') return null // 插值：那不是字面
    text += bodyOf(g, start)
  }
  return text
}

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  // 單一個字串——本體的寫法見 `body.ts`
  registry.register('python:lift_string_literal', (node) => {
    const value = plainBody(node)
    return value === null ? null : createNode('python:literal_string', { value }, {})
  })

  registry.register('python:lift_concatenated_string', (node) => {
    const parts: string[] = []
    for (const c of node.namedChildren) {
      if (c.type !== 'string') return null
      // 只收「純字面」：有插值的那一段不是字面
      const body = plainBody(c)
      if (body === null) return null
      parts.push(body)
    }
    if (parts.length < 2) return null
    const made = createNode('python:literal_string', { value: parts.join('') }, {})
    // 🔴 **語義是一個字串，而寫法是使用者的**：`"abc" "def"` 產回去要是兩段。
    //    與括號那一筆同一條線——見 `code-generator` 的 `verbatim`。
    made.metadata = { ...(made.metadata ?? {}), layoutHints: { verbatim: true } }
    return made
  })
}
