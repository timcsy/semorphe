/** `cpp:container_append` 的 **generate** 路——從共用檔原封剪過來（批次第九批：容器方法資料表）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:container_append', (node, ctx) => {
      // 🔴 接收者是接點——`m[k].push_back(x)` 的 `m[k]` 是一棵樹，不是一串文字
      const obj = generateExpression((node.slots.obj ?? [])[0], ctx)
      const val = generateExpression((node.slots.value ?? [])[0], ctx)
      return `${indent(ctx)}${obj}.push_back(${val});\n`
    })
}
