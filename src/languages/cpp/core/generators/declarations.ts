import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../../core/projection/code-generator'

export function registerDeclarationGenerators(g: Map<string, NodeGenerator>): void {
  g.set('var_declare', (node, ctx) => {
    const type = node.properties.type ?? 'int'
    const declarators = node.children.declarators ?? []

    // Multi-variable: int x, v1 = 0;
    if (declarators.length > 0) {
      const parts = declarators.map(d => {
        const name = d.properties.name ?? 'x'
        const inits = d.children.initializer ?? []
        if (inits.length > 0) {
          return `${name} = ${generateExpression(inits[0], ctx)}`
        }
        return name
      })
      return `${indent(ctx)}${type} ${parts.join(', ')};\n`
    }

    // Single variable
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

  g.set('forward_decl', (node, ctx) => {
    const returnType = node.properties.return_type as string | undefined
    const name = node.properties.name ?? ''
    const params = node.properties.params

    // Structured form: return_type + name + params[]
    if (returnType !== undefined) {
      const paramStr = Array.isArray(params) ? params.join(', ') : ''
      return `${indent(ctx)}${returnType} ${name}(${paramStr});\n`
    }

    // Legacy form: name contains the full declaration text
    const nameStr = String(name)
    const trimmed = nameStr.endsWith(';') ? nameStr : nameStr + ';'
    return `${indent(ctx)}${trimmed}\n`
  })

  g.set('array_declare', (node, ctx) => {
    const type = node.properties.type ?? 'int'
    const name = node.properties.name ?? 'arr'
    const sizeNodes = node.children.size ?? []
    const size = sizeNodes.length > 0 ? generateExpression(sizeNodes[0], ctx) : (node.properties.size ?? '10')
    return `${indent(ctx)}${type} ${name}[${size}];\n`
  })

  g.set('array_access', (node, ctx) => {
    const name = node.properties.name ?? 'arr'
    const indexNodes = node.children.index ?? []
    const idx = indexNodes.length > 0 ? generateExpression(indexNodes[0], ctx) : '0'
    return `${name}[${idx}]`
  })

  g.set('array_assign', (node, ctx) => {
    const name = node.properties.name ?? 'arr'
    const indexNodes = node.children.index ?? []
    const idx = indexNodes.length > 0 ? generateExpression(indexNodes[0], ctx) : '0'
    const vals = node.children.value ?? []
    const val = vals.length > 0 ? generateExpression(vals[0], ctx) : '0'
    return `${indent(ctx)}${name}[${idx}] = ${val};\n`
  })
}
