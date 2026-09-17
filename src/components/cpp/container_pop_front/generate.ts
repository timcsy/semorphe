import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression} from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  // 語句元件——回傳整行（含縮排與換行）
  g.set('cpp:container_pop_front', (node, ctx) => {
    // 🔴 接收者是接點——`m[k].f()` 的 `m[k]` 是一棵樹，不是一串文字
    const obj = generateExpression((node.slots.obj ?? [])[0], ctx)
    return `${indent(ctx)}${obj}.pop_front();\n`
  })
}
