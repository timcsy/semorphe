import type { SemanticNode, StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent, indented, generateExpression, generateBody, trackOwnText } from '../../../../core/projection/code-generator'
import { computeAutoIncludes } from '../../auto-include'
import type { ModuleRegistry } from '../../std/module-registry'
import { createNode } from '../../../../core/semantic-tree'

export function registerStatementGenerators(g: Map<string, NodeGenerator>, style: StylePreset): void {
  const openBrace = style.brace_style === 'Allman'
    ? (ctx: Parameters<NodeGenerator>[1]) => `\n${indent(ctx)}{`
    : () => ' {'
  g.set('program', (node, ctx) => {
    const body = node.children.body ?? []

    // Auto-include: inject headers for concepts used in the tree
    let effectiveBody = body
    if (ctx.moduleRegistry) {
      const autoHeaders = computeAutoIncludes(node, ctx.moduleRegistry as ModuleRegistry)
      if (autoHeaders.length > 0) {
        // Find insertion point: after existing #include blocks
        const lastIncludeIdx = body.reduce((acc, n, i) =>
          (n.concept === 'cpp_include' || n.concept === 'cpp_include_local') ? i : acc, -1)
        const insertAt = lastIncludeIdx + 1
        const autoNodes: SemanticNode[] = autoHeaders.map(h =>
          createNode('cpp_include', { header: h.replace(/^<|>$/g, ''), local: false })
        )
        effectiveBody = [
          ...body.slice(0, insertAt),
          ...autoNodes,
          ...body.slice(insertAt),
        ]
      }
    }

    // Deduplicate consecutive #include directives with identical header
    const seen = new Set<string>()
    const deduped = effectiveBody.filter(n => {
      if (n.concept === 'cpp_include' || n.concept === 'cpp_include_local') {
        const key = `${n.concept}:${n.properties.header}`
        if (seen.has(key)) return false
        seen.add(key)
      }
      return true
    })
    return generateBody(deduped, ctx)
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
    if (elseBody.length === 1 && elseBody[0].concept === 'if' && elseBody[0].properties.isElseIf === 'true') {
      // else-if chain: produce "} else if (...) {" instead of nested "} else { if ... }"
      const elseIfSep = style.brace_style === 'Allman' ? '\n' + indent(ctx) : ' '
      trackOwnText(ctx, `${indent(ctx)}}` + elseIfSep + 'else ')
      code += elseIfSep + 'else '
      // Recursively generate the if node at same indentation (no extra indent)
      code += ifGenerator(elseBody[0], ctx).replace(new RegExp('^' + indent(ctx)), '')
      return code
    }
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
    // Array element increment: arr[i]++
    const indexNodes = node.children.index ?? []
    if (indexNodes.length > 0) {
      const idx = generateExpression(indexNodes[0], ctx)
      if (pos === 'prefix') {
        return `${indent(ctx)}${op}${name}[${idx}];\n`
      }
      return `${indent(ctx)}${name}[${idx}]${op};\n`
    }
    if (pos === 'prefix') {
      return `${indent(ctx)}${op}${name};\n`
    }
    return `${indent(ctx)}${name}${op};\n`
  })

  g.set('cpp_do_while', (node, ctx) => {
    const body = node.children.body ?? []
    const cond = generateExpression((node.children.cond ?? [])[0], ctx)
    const header = `${indent(ctx)}do${openBrace(ctx)}\n`
    trackOwnText(ctx, header)
    let code = header
    code += generateBody(body, indented(ctx))
    code += `${indent(ctx)}} while (${cond});\n`
    return code
  })

  g.set('cpp_switch', (node, ctx) => {
    const expr = generateExpression((node.children.expr ?? [])[0], ctx)
    const cases = node.children.cases ?? []
    const header = `${indent(ctx)}switch (${expr})${openBrace(ctx)}\n`
    trackOwnText(ctx, header)
    let code = header
    code += generateBody(cases, indented(ctx))
    code += `${indent(ctx)}}\n`
    return code
  })

  g.set('cpp_case', (node, ctx) => {
    const val = generateExpression((node.children.value ?? [])[0], ctx)
    const body = node.children.body ?? []
    let code = `${indent(ctx)}case ${val}:\n`
    code += generateBody(body, indented(ctx))
    return code
  })

  g.set('cpp_default', (node, ctx) => {
    const body = node.children.body ?? []
    let code = `${indent(ctx)}default:\n`
    code += generateBody(body, indented(ctx))
    return code
  })

  g.set('cpp_pointer_assign', (node, ctx) => {
    const ptrName = node.properties.ptr_name ?? 'ptr'
    const vals = node.children.value ?? []
    if (vals.length > 0) {
      const val = generateExpression(vals[0], ctx)
      return `${indent(ctx)}*${ptrName} = ${val};\n`
    }
    return `${indent(ctx)}*${ptrName} = 0;\n`
  })
}
