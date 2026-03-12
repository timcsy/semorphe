import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { generateExpression } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {
  // cpp:math_pow uses codeTemplate-based generation (defined in blocks.json)

  g.set('cpp:math_unary', (node, ctx) => {
    const func = (node.properties.func as string) ?? 'abs'
    const value = generateExpression((node.children.value ?? [])[0], ctx)
    return `${func}(${value})`
  })

  g.set('cpp:math_binary', (node, ctx) => {
    const func = (node.properties.func as string) ?? 'fmod'
    const arg1 = generateExpression((node.children.arg1 ?? [])[0], ctx)
    const arg2 = generateExpression((node.children.arg2 ?? [])[0], ctx)
    return `${func}(${arg1}, ${arg2})`
  })
}
