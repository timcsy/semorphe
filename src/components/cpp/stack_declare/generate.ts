/** `cpp:stack_declare` 的 **generate** 路——從共用檔原封剪過來（批次第七批：容器樣板過渡表退場）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  // Statement components — return full line with indent and newline
    g.set('cpp:stack_declare', (node, ctx) => {
      const type = node.properties.type ?? 'int'
      const name = node.properties.name ?? 'stk'
      return `${indent(ctx)}stack<${type}> ${name};\n`
    })
}
