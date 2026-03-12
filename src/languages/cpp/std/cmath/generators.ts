import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { generateExpression } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {
  g.set('cpp:math_pow', (node, ctx) => {
    const base = generateExpression((node.children.base ?? [])[0], ctx)
    const exponent = generateExpression((node.children.exponent ?? [])[0], ctx)
    return `pow(${base}, ${exponent})`
  })

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
