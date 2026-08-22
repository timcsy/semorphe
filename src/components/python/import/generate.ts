/** `python:import` 的 **generate** 路——`import math` / `import math as m`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:import', (node, ctx) => {
    const alias = String(node.properties.alias ?? '').trim()
    return `${indent(ctx)}import ${node.properties.name ?? 'math'}${alias ? ` as ${alias}` : ''}\n`
  })
}
