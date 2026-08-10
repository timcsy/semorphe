/** `cpp:literal_char` 的 **generate** 路——從 `core/generators/expressions.ts` 原封搬過來。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:literal_char', (node, _ctx) => {
    const ch = node.properties.char ?? 'a'
    return `'${ch}'`
  })
}
