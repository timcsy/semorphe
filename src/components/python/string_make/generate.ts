/**
 * `python:string_make` 的 **generate** 路——`f"文字{值}文字"`。
 *
 * ⚠️ **引號一律用雙引號**，而內容裡的雙引號要跳脫。
 * 原始碼可能是單引號寫的（`f'{a}'`），而**引號的選擇不是語義**——
 * 語義是「這一段是格式化文字，由這些片段組成」。
 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { generateExpression } from '../../../core/projection/code-generator'
import { componentTraits } from '../../../core/component/traits'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('python:string_make', (node, ctx) => {
    const parts = node.children.parts ?? []
    const body = parts
      .map((p) => {
        // 字面片段：原樣放進引號裡（**不**再包一層引號——它已經在字串內部了）
        //
        // 🔴 **問性狀，不比身分**：`id === 'python:literal_string'` 在那顆改名時
        //    會安靜地永遠為假，症狀是每一段文字都被當成運算式送去產生器。
        if (componentTraits(p.componentId)?.stringLiteral === true) {
          return String(p.properties.value ?? '').replace(/"/g, '\\"')
        }
        return generateExpression(p, ctx)
      })
      .join('')
    return `f"${body}"`
  })
}
