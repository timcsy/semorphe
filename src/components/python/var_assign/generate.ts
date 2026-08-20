/** `python:var_assign` 的 **generate** 路——**沒有型別，沒有分號**。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:var_assign', (node, ctx) => {
    const name = String(node.properties.obj ?? 'x')
    const value = generateExpression((node.children.value ?? [])[0], ctx)
    return `${indent(ctx)}${name} = ${value}\n`
  })
}
