import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../../core/projection/code-generator'

export function registerGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {
  g.set('cpp_strlen', (node, ctx) => {
    const str = generateExpression((node.children.str ?? [])[0], ctx)
    return `strlen(${str})`
  })

  g.set('cpp_strcmp', (node, ctx) => {
    const s1 = generateExpression((node.children.s1 ?? [])[0], ctx)
    const s2 = generateExpression((node.children.s2 ?? [])[0], ctx)
    return `strcmp(${s1}, ${s2})`
  })

  g.set('cpp_strcpy', (node, ctx) => {
    const dest = generateExpression((node.children.dest ?? [])[0], ctx)
    const src = generateExpression((node.children.src ?? [])[0], ctx)
    return `${indent(ctx)}strcpy(${dest}, ${src});\n`
  })
}
