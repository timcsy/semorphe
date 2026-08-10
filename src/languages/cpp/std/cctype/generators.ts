import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { generateExpression } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {
  // ⚠️ isalpha 已膠囊化（src/components/cpp/char_is_alpha）——這裡少一筆是對的
  for (const func of ['isdigit', 'toupper', 'tolower']) {
    g.set(`cpp_${func}`, (node, ctx) => {
      const value = generateExpression((node.children.value ?? [])[0], ctx)
      return `${func}(${value})`
    })
  }
}
