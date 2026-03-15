import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { generateExpression } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {
  for (const func of ['isalpha', 'isdigit', 'toupper', 'tolower']) {
    g.set(`cpp_${func}`, (node, ctx) => {
      const value = generateExpression((node.children.value ?? [])[0], ctx)
      return `${func}(${value})`
    })
  }
}
