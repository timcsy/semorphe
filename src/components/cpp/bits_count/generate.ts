/** `cpp:bits_count` 的 **generate** 路——兩種寫法由 `form` 決定。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:bits_count', (node, ctx) => {
    const value = node.slots.obj?.[0]
    // 引數是必要的（宣告 min: 1）——缺了就補 `0`，那至少編得過而且答案顯然
    const inner = value ? generateExpression(value, ctx) : '0'
    /**
     * 🔴 **產出使用者寫的那一種**——`bs.count()` 不得變成 `__builtin_popcount(bs)`
     *（那連編都編不過：內建那顆吃的是整數）。
     * 同族取端點那顆記過一模一樣的一條：`begin(a)` 不得產成 `a.begin()`。
     */
    /**
     * ⚠️ 那一格裝的是**使用者寫的那個名字**（`count` 或 `__builtin_popcount`）
     * ——兩條路徑都填它，見 `component.json` 的 `_properties_why`。
     */
    return String(node.properties.method ?? '__builtin_popcount') === 'count'
      ? `${inner}.count()`
      : `__builtin_popcount(${inner})`
  })
}
