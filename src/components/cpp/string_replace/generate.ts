/** `cpp:string_replace` 的 **generate** 路——從共用檔原封剪過來（批次第五批：lift 是 io.ts 的方法 case（純資料））。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:string_replace', (node, ctx) => {
      // 🔴 接收者是接點——`m[k].f()` 的 `m[k]` 是一棵樹，不是一串文字
      const obj = generateExpression((node.slots.obj ?? [])[0], ctx)
      const posNodes = node.slots.pos ?? []
      const lenNodes = node.slots.len ?? []
      const valueNodes = node.slots.value ?? []
      const pos = posNodes.length > 0 ? generateExpression(posNodes[0], ctx) : '0'
      const len = lenNodes.length > 0 ? generateExpression(lenNodes[0], ctx) : '0'
      const val = valueNodes.length > 0 ? generateExpression(valueNodes[0], ctx) : '""'
      return `${indent(ctx)}${obj}.replace(${pos}, ${len}, ${val});\n`
    })
}
