import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  // 語句元件——回傳整行（含縮排與換行）
  g.set('cpp:container_pop_front', (node, ctx) => {
    const obj = node.properties.obj ?? 'dq'
    return `${indent(ctx)}${obj}.pop_front();\n`
  })
}
