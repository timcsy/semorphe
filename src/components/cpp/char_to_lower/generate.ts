/**
 * `cpp:char_to_lower` 的 **generate** 路：`tolower(x)`（同 `cpp:char_is_alpha`）
 *
 * 🔴 第 402 刀之前這一路是空的（`component.json` 寫著「顯式的空，不是遺漏」——而它是遺漏）：
 * 從程式碼 lift 進來的節點帶著 `rawCode`，產碼退回原文，所以看起來是對的；
 * **從積木抽回來的節點沒有原文**，於是學生一動積木，`tolower(c)` 就變成 `⟨cpp:char_to_lower⟩`（盲測 fuzz-cpp-student-mixed 抓到）。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:char_to_lower', (node, ctx) => {
    const v = (node.slots.value ?? [])[0]
    if (!v) throw new Error('cpp:char_to_lower 少了 value 子節點——語義樹壞了')
    return `tolower(${generateExpression(v, ctx)})`
  })
}
