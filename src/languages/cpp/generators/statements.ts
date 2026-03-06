import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateExpression, generateBody } from '../../../core/projection/code-generator'

export function registerStatementGenerators(g: Map<string, NodeGenerator>): void {
  g.set('program', (node, ctx) => {
    return generateBody(node.children.body ?? [], ctx)
  })

  g.set('if', (node, ctx) => {
    const cond = generateExpression((node.children.condition ?? [])[0], ctx)
    const thenBody = node.children.then_body ?? []
    const elseBody = node.children.else_body ?? []
    let code = `${indent(ctx)}if (${cond}) {\n`
    code += generateBody(thenBody, indented(ctx))
    code += `${indent(ctx)}}`
    if (elseBody.length > 0) {
      code += ` else {\n`
      code += generateBody(elseBody, indented(ctx))
      code += `${indent(ctx)}}`
    }
    code += '\n'
    return code
  })

  g.set('while_loop', (node, ctx) => {
    const cond = generateExpression((node.children.condition ?? [])[0], ctx)
    const body = node.children.body ?? []
    let code = `${indent(ctx)}while (${cond}) {\n`
    code += generateBody(body, indented(ctx))
    code += `${indent(ctx)}}\n`
    return code
  })

  g.set('count_loop', (node, ctx) => {
    const varName = node.properties.var_name ?? 'i'
    const from = generateExpression((node.children.from ?? [])[0], ctx)
    const to = generateExpression((node.children.to ?? [])[0], ctx)
    const body = node.children.body ?? []
    let code = `${indent(ctx)}for (int ${varName} = ${from}; ${varName} < ${to}; ${varName}++) {\n`
    code += generateBody(body, indented(ctx))
    code += `${indent(ctx)}}\n`
    return code
  })

  g.set('break', (_node, ctx) => `${indent(ctx)}break;\n`)
  g.set('continue', (_node, ctx) => `${indent(ctx)}continue;\n`)

  g.set('func_def', (node, ctx) => {
    const name = node.properties.name ?? 'f'
    const returnType = node.properties.return_type ?? 'void'
    const params = node.properties.params
    const paramStr = Array.isArray(params) ? params.join(', ') : ''
    const body = node.children.body ?? []
    let code = `${indent(ctx)}${returnType} ${name}(${paramStr}) {\n`
    code += generateBody(body, indented(ctx))
    code += `${indent(ctx)}}\n`
    return code
  })

  g.set('func_call', (node, ctx) => {
    const name = node.properties.name ?? 'f'
    const args = (node.children.args ?? []).map(a => generateExpression(a, ctx))
    return `${indent(ctx)}${name}(${args.join(', ')});\n`
  })

  g.set('return', (node, ctx) => {
    const vals = node.children.value ?? []
    if (vals.length > 0) {
      const val = generateExpression(vals[0], ctx)
      return `${indent(ctx)}return ${val};\n`
    }
    return `${indent(ctx)}return;\n`
  })
}
