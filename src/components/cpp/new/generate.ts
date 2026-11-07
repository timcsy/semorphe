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
      const size = (node.slots.size ?? [])[0]
      // 🔴 陣列的值初始化（`new int[n]()`、`new int[n]{}`——每格歸零）：原本括號被丟掉，來回一趟就變成不歸零（元件管線 322 的盲測抓到）
      if (size) return `new ${type}[${generateExpression(size, ctx)}]${node.properties.brace === 'true' ? '{}' : node.properties.valueInit === 'true' ? '()' : ''}`
      // 引數是運算式槽（328）
      const args = (node.slots.args ?? []).map(a => generateExpression(a, ctx)).join(', ')
      // `new T{…}`（大括號初始化）——括號的種類是屬性 `brace`（空的 `new T{}` 也是值初始化）
      if (node.properties.brace === 'true') return `new ${type}{${args}}`
      if (args) return `new ${type}(${args})`
      // 空括號＝值初始化（`new int()` 是 0）——見 lift 的註解
      return node.properties.valueInit === 'true' ? `new ${type}()` : `new ${type}`
    })
}
