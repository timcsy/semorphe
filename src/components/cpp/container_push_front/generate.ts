import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  // 語句元件——回傳整行（含縮排與換行）
  g.set('cpp:container_push_front', (node, ctx) => {
    const obj = node.properties.obj ?? 'dq'
    const value = (node.slots.value ?? [])[0]
    const arg = value ? generateExpression(value, ctx) : ''
    return `${indent(ctx)}${obj}.push_front(${arg});\n`
  })
}
