import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerDeclarationGenerators(g: Map<string, NodeGenerator>): void {
  g.set('var_declare', (node, ctx) => {
    const type = node.properties.type ?? 'int'
    const name = node.properties.name ?? 'x'
    const inits = node.children.initializer ?? []
    if (inits.length > 0) {
      const val = generateExpression(inits[0], ctx)
      return `${indent(ctx)}${type} ${name} = ${val};\n`
    }
    return `${indent(ctx)}${type} ${name};\n`
  })

  g.set('var_assign', (node, ctx) => {
    const name = node.properties.name ?? 'x'
    const vals = node.children.value ?? []
    if (vals.length > 0) {
      const val = generateExpression(vals[0], ctx)
      return `${indent(ctx)}${name} = ${val};\n`
    }
    return `${indent(ctx)}${name};\n`
  })

  g.set('array_declare', (node, ctx) => {
    const type = node.properties.type ?? 'int'
    const name = node.properties.name ?? 'arr'
    const size = node.properties.size ?? '10'
    return `${indent(ctx)}${type} ${name}[${size}];\n`
  })

  g.set('array_access', (node, ctx) => {
    const name = node.properties.name ?? 'arr'
    const idx = generateExpression((node.children.index ?? [])[0], ctx)
    return `${name}[${idx}]`
  })
}
