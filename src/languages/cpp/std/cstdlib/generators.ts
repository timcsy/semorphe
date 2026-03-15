import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {
  g.set('cpp_rand', () => {
    return `rand()`
  })

  g.set('cpp_srand', (node, ctx) => {
    const seed = generateExpression((node.children.seed ?? [])[0], ctx)
    return `${indent(ctx)}srand(${seed});\n`
  })

  g.set('cpp_abs', (node, ctx) => {
    const value = generateExpression((node.children.value ?? [])[0], ctx)
    return `abs(${value})`
  })

  g.set('cpp_exit', (node, ctx) => {
    const code = generateExpression((node.children.code ?? [])[0], ctx)
    return `${indent(ctx)}exit(${code});\n`
  })

  g.set('cpp_atoi', (node, ctx) => {
    const str = generateExpression((node.children.str ?? [])[0], ctx)
    return `atoi(${str})`
  })

  g.set('cpp_atof', (node, ctx) => {
    const str = generateExpression((node.children.str ?? [])[0], ctx)
    return `atof(${str})`
  })
}
