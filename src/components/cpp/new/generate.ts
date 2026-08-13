/**
 * `cpp:new` 的 **generate** 路
 *
 * ⚠️ `new int[n]` 的 `[n]` 原本產不回來（lift 也接不住，**兩邊對稱**）。
 * 見 `lift-strategy.ts` 的檔頭。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:new', (node, ctx) => {
      const type = node.properties.type ?? 'int'
      const size = (node.children.size ?? [])[0]
      if (size) return `new ${type}[${generateExpression(size, ctx)}]`
      const args = node.properties.args ?? ''
      return args ? `new ${type}(${args})` : `new ${type}`
    })
}
