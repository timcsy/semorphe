/** `cpp:ifndef` 的 **generate** 路——從共用檔原封剪過來（批次第二十三批：前置處理指令 → 身分）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:ifndef', (node, _ctx) => {
      const name = node.properties.condition ?? 'MACRO'
      return `#ifndef ${name}\n`
    })
}
