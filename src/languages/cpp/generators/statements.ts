import type { StylePreset } from '../../../core/types'
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, indented, generateExpression, generateBody, trackOwnText } from '../../../core/projection/code-generator'

export function registerStatementGenerators(g: Map<string, NodeGenerator>, style: StylePreset): void {
  const openBrace = style.brace_style === 'Allman'
    ? (ctx: Parameters<NodeGenerator>[1]) => `\n${indent(ctx)}{`
    : () => ' {'
  g.set('program', (node, ctx) => {
    return generateBody(node.children.body ?? [], ctx)
  })

  const ifGenerator: NodeGenerator = (node, ctx) => {
    const cond = generateExpression((node.children.condition ?? [])[0], ctx)
    const thenBody = node.children.then_body ?? []
    const elseBody = node.children.else_body ?? []
    const header = `${indent(ctx)}if (${cond})${openBrace(ctx)}\n`
    trackOwnText(ctx, header)
    let code = header
    code += generateBody(thenBody, indented(ctx))
    code += `${indent(ctx)}}`
    if (elseBody.length > 0) {
      const elseHeader = `${style.brace_style === 'Allman' ? '\n' + indent(ctx) : ' '}else${openBrace(ctx)}\n`
      trackOwnText(ctx, `${indent(ctx)}}` + elseHeader)
      code += elseHeader
      code += generateBody(elseBody, indented(ctx))
      code += `${indent(ctx)}}`
    }
    code += '\n'
    return code
  }
  g.set('if', ifGenerator)
  g.set('if_else', ifGenerator)

  g.set('while_loop', (node, ctx) => {
    const cond = generateExpression((node.children.condition ?? [])[0], ctx)
    const body = node.children.body ?? []
    const header = `${indent(ctx)}while (${cond})${openBrace(ctx)}\n`
    trackOwnText(ctx, header)
    let code = header
    code += generateBody(body, indented(ctx))
    code += `${indent(ctx)}}\n`
    return code
  })

  g.set('count_loop', (node, ctx) => {
    const varName = node.properties.var_name ?? 'i'
    const from = generateExpression((node.children.from ?? [])[0], ctx)
    const to = generateExpression((node.children.to ?? [])[0], ctx)
    const body = node.children.body ?? []
    const inclusive = node.properties.inclusive === 'TRUE'
    const op = inclusive ? '<=' : '<'
    const header = `${indent(ctx)}for (int ${varName} = ${from}; ${varName} ${op} ${to}; ${varName}++)${openBrace(ctx)}\n`
    trackOwnText(ctx, header)
    let code = header
    code += generateBody(body, indented(ctx))
    code += `${indent(ctx)}}\n`
    return code
  })

  g.set('cpp_for_loop', (node, ctx) => {
    const strip = (s: string) => s.replace(/;\s*$/, '').trim()
    const initExpr = strip(generateExpression((node.children.init ?? [])[0], ctx))
    const condExpr = strip(generateExpression((node.children.cond ?? [])[0], ctx))
    const updateExpr = strip(generateExpression((node.children.update ?? [])[0], ctx))
    const body = node.children.body ?? []
    const header = `${indent(ctx)}for (${initExpr}; ${condExpr}; ${updateExpr})${openBrace(ctx)}\n`
    trackOwnText(ctx, header)
    let code = header
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
    const header = `${indent(ctx)}${returnType} ${name}(${paramStr})${openBrace(ctx)}\n`
    trackOwnText(ctx, header)
    let code = header
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

  // C++ specific statements
  g.set('cpp_include', (node, _ctx) => {
    const header = node.properties.header ?? 'iostream'
    return `#include <${header}>\n`
  })

  g.set('cpp_include_local', (node, _ctx) => {
    const header = node.properties.header ?? 'myheader.h'
    return `#include "${header}"\n`
  })

  g.set('cpp_using_namespace', (node, ctx) => {
    const ns = node.properties.ns ?? 'std'
    return `${indent(ctx)}using namespace ${ns};\n`
  })

  g.set('cpp_define', (node, _ctx) => {
    const name = node.properties.name ?? 'MACRO'
    const value = node.properties.value ?? ''
    return `#define ${name} ${value}\n`
  })

  g.set('cpp_compound_assign', (node, ctx) => {
    const name = node.properties.name ?? 'x'
    const op = node.properties.operator ?? '+='
    const vals = node.children.value ?? []
    if (vals.length > 0) {
      const val = generateExpression(vals[0], ctx)
      return `${indent(ctx)}${name} ${op} ${val};\n`
    }
    return `${indent(ctx)}${name} ${op} 0;\n`
  })

  g.set('cpp_increment', (node, ctx) => {
    const name = (node.properties.name ?? node.properties.NAME ?? 'i') as string
    const op = (node.properties.operator ?? node.properties.OP ?? '++') as string
    const pos = (node.properties.position ?? node.properties.POSITION ?? 'postfix') as string
    if (pos === 'prefix') {
      return `${indent(ctx)}${op}${name};\n`
    }
    return `${indent(ctx)}${name}${op};\n`
  })
}
