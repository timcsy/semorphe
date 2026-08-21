/** `python:method_call` 的 **generate** 路——`nums.append(9)`。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:method_call', (node, ctx) => {
    const o = (node.children.obj ?? [])[0]
    const args = (node.children.args ?? []).map((a) => generateExpression(a, ctx)).join(', ')
    const call = `${o ? generateExpression(o, ctx) : ''}.${node.properties.method ?? ''}(${args})`
    // 語句位置由核心的共用機制包縮排與換行（見 `core/expression-statement.ts`）
    void indent
    return call
  })
}
