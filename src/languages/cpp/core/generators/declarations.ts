import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent, generateExpression, generateBody, indented } from '../../../../core/projection/code-generator'

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
    const returnType = node.properties.return_type ?? 'void'
    const name = node.properties.name ?? ''
    const paramChildren = node.children.params ?? []
    const paramStr = paramChildren.map(p => {
      const t = String(p.properties.type ?? 'int')
      const n = String(p.properties.name ?? '')
      if (t.endsWith('[]')) {
        const baseType = t.slice(0, -2)
        return n ? `${baseType} ${n}[]` : `${baseType}[]`
      }
      return n ? `${t} ${n}` : t
    }).join(', ')
    return `${indent(ctx)}${returnType} ${name}(${paramStr});\n`
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

  g.set('cpp_enum', (node, ctx) => {
    const name = node.properties.name ?? 'MyEnum'
    const values = node.properties.values ?? ''
    return `${indent(ctx)}enum ${name} { ${values} };\n`
  })

  g.set('cpp_range_for', (node, ctx) => {
    const varType = node.properties.var_type ?? 'auto'
    const varName = node.properties.var_name ?? 'x'
    const container = node.properties.container ?? 'vec'
    const bodyNodes = node.children.body ?? []
    const bodyCode = generateBody(bodyNodes, indented(ctx))
    const ind = indent(ctx)
    return `${ind}for (${varType} ${varName} : ${container}) {\n${bodyCode}${ind}}\n`
  })

  g.set('cpp_array_2d_declare', (node, ctx) => {
    const type = node.properties.type ?? 'int'
    const name = node.properties.name ?? 'arr'
    const rows = node.properties.rows ?? '3'
    const cols = node.properties.cols ?? '4'
    return `${indent(ctx)}${type} ${name}[${rows}][${cols}];\n`
  })

  g.set('cpp_array_2d_access', (node, ctx) => {
    const name = node.properties.name ?? 'arr'
    const rowNodes = node.children.row ?? []
    const colNodes = node.children.col ?? []
    const row = rowNodes.length > 0 ? generateExpression(rowNodes[0], ctx) : '0'
    const col = colNodes.length > 0 ? generateExpression(colNodes[0], ctx) : '0'
    return `${name}[${row}][${col}]`
  })

  g.set('cpp_array_2d_assign', (node, ctx) => {
    const name = node.properties.name ?? 'arr'
    const rowNodes = node.children.row ?? []
    const colNodes = node.children.col ?? []
    const vals = node.children.value ?? []
    const row = rowNodes.length > 0 ? generateExpression(rowNodes[0], ctx) : '0'
    const col = colNodes.length > 0 ? generateExpression(colNodes[0], ctx) : '0'
    const val = vals.length > 0 ? generateExpression(vals[0], ctx) : '0'
    return `${indent(ctx)}${name}[${row}][${col}] = ${val};\n`
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
