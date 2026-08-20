/** `cpp:print` 的 **generate** 路——從共用檔原封剪過來（批次第三十九批）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import type { StylePreset } from '../../../core/types'
// ⚠️ 共用的是**演算法**（`<<` 的排版），不是身分。
import { needsParensInCout } from '../../../languages/cpp/std/iostream/generators'
import { indent, generateExpression } from '../../../core/projection/code-generator'
import { isStringLiteral } from '../../../languages/cpp/core/node-traits'
import { isLineBreak } from '../../../languages/cpp/core/node-traits'

export function registerGenerate(g: Map<string, NodeGenerator>, style: StylePreset): void {
  g.set('cpp:print', (node, ctx) => {
      const values = node.children.values ?? []
      if (style.io_style === 'cout') {
        const parts = values.map(v => {
          const expr = generateExpression(v, ctx)
          if (needsParensInCout(v)) return `(${expr})`
          return expr
        })
        return `${indent(ctx)}cout << ${parts.join(' << ')};\n`
      }
      // printf mode: embed string_literal values into format, use %d for expressions
      const hasEndl = values.some(v => isLineBreak(v.componentId))
      const fmtParts: string[] = []
      const argParts: string[] = []
      for (const v of values) {
        if (isLineBreak(v.componentId)) continue
        if (isStringLiteral(v.componentId)) {
          fmtParts.push((v.properties.value as string) ?? '')
        } else {
          fmtParts.push('%d')
          argParts.push(generateExpression(v, ctx))
        }
      }
      if (fmtParts.length === 0 && hasEndl) {
        return `${indent(ctx)}printf("\\n");\n`
      }
      const fmt = fmtParts.join('') + (hasEndl ? '\\n' : '')
      if (argParts.length > 0) {
        return `${indent(ctx)}printf("${fmt}", ${argParts.join(', ')});\n`
      }
      return `${indent(ctx)}printf("${fmt}");\n`
    })
}
