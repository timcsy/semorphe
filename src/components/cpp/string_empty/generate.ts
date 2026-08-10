/** `cpp:string_empty` 的 **generate** 路——從 `std/string/generators.ts` 原封搬過來。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:string_empty', (node) => {
    const obj = node.properties.obj ?? 'str'
    return `${obj}.empty()`
  })
}
