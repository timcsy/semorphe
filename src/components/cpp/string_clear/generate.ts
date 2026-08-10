/** `cpp:string_clear` 的 **generate** 路——從共用檔原封剪過來（批次第十三批：依型別分派的方法表）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:string_clear', (node, ctx) => {
      const obj = node.properties.obj ?? 'str'
      return `${indent(ctx)}${obj}.clear();\n`
    })
}
