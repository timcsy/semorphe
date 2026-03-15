import type { SemanticNode, StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent, indented, generateExpression, generateBody, trackOwnText } from '../../../../core/projection/code-generator'
import { computeAutoIncludes } from '../../auto-include'
import { normalizeHeader } from '../../header-aliases'
import type { DependencyResolver } from '../../../../core/dependency-resolver'
import { createNode } from '../../../../core/semantic-tree'

export function registerStatementGenerators(g: Map<string, NodeGenerator>, style: StylePreset): void {
  const openBrace = style.brace_style === 'Allman'
    ? (ctx: Parameters<NodeGenerator>[1]) => `\n${indent(ctx)}{`
    : () => ' {'
  g.set('program', (node, ctx) => {
    const body = node.children.body ?? []

    // Scaffold-driven code generation: when ProgramScaffold is available
    // and the tree body does NOT already contain a main function (i.e., body-only tree from L0).
    // If the tree has func_def(main), it's a full tree — use legacy path to avoid duplication.
    const hasMainFunc = body.some(n => n.concept === 'func_def' && n.properties.name === 'main')
    if (ctx.programScaffold && ctx.scaffoldConfig && !hasMainFunc) {
      // Collect manual includes from body for deduplication
      const manualImports: string[] = []
      for (const n of body) {
        if (n.concept === 'cpp_include' && typeof n.properties.header === 'string') {
          manualImports.push(`<${n.properties.header}>`)
        }
      }

      const scaffoldResult = ctx.programScaffold.resolve(node, {
        ...ctx.scaffoldConfig,
        manualImports,
      })
      // Build output: scaffold imports → manual includes → preamble → entryPoint → body → epilogue
      // Always output all scaffold items regardless of visibility (code must be complete)
      let code = ''

      // Scaffold imports (auto-generated)
      for (const item of scaffoldResult.imports) {
        code += item.code + '\n'
      }

      // Manual includes from body (deduplicated)
      const seenIncludes = new Set<string>()
      for (const n of body) {
        if (n.concept === 'cpp_include' || n.concept === 'cpp_include_local') {
          const key = `${n.concept}:${normalizeHeader(String(n.properties.header))}`
          if (seenIncludes.has(key)) continue
          seenIncludes.add(key)
          code += generateBody([n], ctx)
        }
      }

      // Preamble
      for (const item of scaffoldResult.preamble) {
        code += item.code + '\n'
      }

      // Entry point
      for (const item of scaffoldResult.entryPoint) {
        code += item.code + '\n'
      }

      // Track scaffold lines for source mapping before generating user body
      trackOwnText(ctx, code)

      // User body (excluding includes, indented inside main)
      const userBody = body.filter(n =>
        n.concept !== 'cpp_include' && n.concept !== 'cpp_include_local'
      )
      code += generateBody(userBody, indented(ctx))

      // Epilogue
      for (const item of scaffoldResult.epilogue) {
        code += item.code + '\n'
      }

      return code
    }

    // Fallback: auto-include without scaffold (legacy path)
    let effectiveBody = body
    if (ctx.dependencyResolver) {
      const autoEdges = computeAutoIncludes(node, ctx.dependencyResolver as DependencyResolver)
      if (autoEdges.length > 0) {
        // Find insertion point: after existing #include blocks
        const lastIncludeIdx = body.reduce((acc, n, i) =>
          (n.concept === 'cpp_include' || n.concept === 'cpp_include_local') ? i : acc, -1)
        const insertAt = lastIncludeIdx + 1
        const autoNodes: SemanticNode[] = autoEdges.map(e =>
          createNode('cpp_include', { header: e.header.replace(/^<|>$/g, ''), local: false })
        )
        effectiveBody = [
          ...body.slice(0, insertAt),
          ...autoNodes,
          ...body.slice(insertAt),
        ]
      }
    }

    // Deduplicate #include directives with identical or equivalent headers
    const seen = new Set<string>()
    const deduped = effectiveBody.filter(n => {
      if (n.concept === 'cpp_include' || n.concept === 'cpp_include_local') {
        const key = `${n.concept}:${normalizeHeader(String(n.properties.header))}`
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

  g.set('cpp_ifdef', (node, _ctx) => {
    const name = node.properties.name ?? 'MACRO'
    return `#ifdef ${name}\n`
  })

  g.set('cpp_ifndef', (node, _ctx) => {
    const name = node.properties.name ?? 'MACRO'
    return `#ifndef ${name}\n`
  })

  g.set('comment', (node, ctx) => {
    const text = node.properties.text ?? ''
    return `${indent(ctx)}// ${text}\n`
  })

  g.set('block_comment', (node, ctx) => {
    const text = node.properties.text ?? ''
    return `${indent(ctx)}/* ${text} */\n`
  })

  g.set('doc_comment', (node, ctx) => {
    const brief = node.properties.brief ?? ''
    return `${indent(ctx)}/// ${brief}\n`
  })

  g.set('cpp_raw_code', (node, ctx) => {
    const code = String(node.properties.code ?? '')
    return `${indent(ctx)}${code}\n`
  })

  g.set('cpp_raw_expression', (node, _ctx) => {
    return String(node.properties.code ?? '')
  })

  g.set('cpp_compound_assign', (node, ctx) => {
    const name = node.properties.name ?? 'x'
    const op = node.properties.operator ?? '+='
    const vals = node.children.value ?? []
    const val = vals.length > 0 ? generateExpression(vals[0], ctx) : '0'
    const expr = `${name} ${op} ${val}`
    if (ctx.isExpression) return expr
    return `${indent(ctx)}${expr};\n`
  })

  g.set('cpp_increment', (node, ctx) => {
    const name = (node.properties.name ?? node.properties.NAME ?? 'i') as string
    const op = (node.properties.operator ?? node.properties.OP ?? '++') as string
    const pos = (node.properties.position ?? node.properties.POSITION ?? 'postfix') as string
    // Array element increment: arr[i]++
    const indexNodes = node.children.index ?? []
    if (indexNodes.length > 0) {
      const idx = generateExpression(indexNodes[0], ctx)
      const expr = pos === 'prefix' ? `${op}${name}[${idx}]` : `${name}[${idx}]${op}`
      if (ctx.isExpression) return expr
      return `${indent(ctx)}${expr};\n`
    }
    const expr = pos === 'prefix' ? `${op}${name}` : `${name}${op}`
    if (ctx.isExpression) return expr
    return `${indent(ctx)}${expr};\n`
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

  g.set('cpp_try_catch', (node, ctx) => {
    const tryBody = node.children.try_body ?? []
    const catchType = node.properties.catch_type ?? 'exception&'
    const catchName = node.properties.catch_name ?? 'e'
    const catchBody = node.children.catch_body ?? []
    const header = `${indent(ctx)}try${openBrace(ctx)}\n`
    trackOwnText(ctx, header)
    let code = header
    code += generateBody(tryBody, indented(ctx))
    const catchHeader = `${indent(ctx)}}${style.brace_style === 'Allman' ? '\n' + indent(ctx) : ' '}catch (${catchType} ${catchName})${openBrace(ctx)}\n`
    trackOwnText(ctx, catchHeader)
    code += catchHeader
    code += generateBody(catchBody, indented(ctx))
    code += `${indent(ctx)}}\n`
    return code
  })

  g.set('cpp_namespace_def', (node, ctx) => {
    const name = node.properties.name ?? 'myns'
    const body = node.children.body ?? []
    const header = `${indent(ctx)}namespace ${name}${openBrace(ctx)}\n`
    trackOwnText(ctx, header)
    let code = header
    code += generateBody(body, indented(ctx))
    code += `${indent(ctx)}}\n`
    return code
  })

  g.set('cpp_throw', (node, ctx) => {
    const vals = node.children.value ?? []
    if (vals.length > 0) {
      const val = generateExpression(vals[0], ctx)
      return `${indent(ctx)}throw ${val};\n`
    }
    return `${indent(ctx)}throw;\n`
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

  g.set('cpp_delete', (node, ctx) => {
    const ptr = generateExpression((node.children.ptr ?? [])[0], ctx)
    return `${indent(ctx)}delete ${ptr};\n`
  })

  g.set('cpp_free', (node, ctx) => {
    const ptr = generateExpression((node.children.ptr ?? [])[0], ctx)
    return `${indent(ctx)}free(${ptr});\n`
  })

  // ─── Generic container methods (used by lifter for shared container ops) ───

  g.set('cpp_container_push', (node, ctx) => {
    const obj = node.properties.obj ?? 'obj'
    const val = generateExpression((node.children.value ?? [])[0], ctx)
    return `${indent(ctx)}${obj}.push(${val});\n`
  })

  g.set('cpp_container_pop', (node, ctx) => {
    const obj = node.properties.obj ?? 'obj'
    return `${indent(ctx)}${obj}.pop();\n`
  })

  g.set('cpp_container_clear', (node, ctx) => {
    const obj = node.properties.obj ?? 'obj'
    return `${indent(ctx)}${obj}.clear();\n`
  })

  g.set('cpp_container_push_back', (node, ctx) => {
    const obj = node.properties.obj ?? 'obj'
    const val = generateExpression((node.children.value ?? [])[0], ctx)
    return `${indent(ctx)}${obj}.push_back(${val});\n`
  })

  g.set('cpp_container_erase', (node, ctx) => {
    const obj = node.properties.obj ?? 'obj'
    const key = generateExpression((node.children.key ?? [])[0], ctx)
    return `${indent(ctx)}${obj}.erase(${key});\n`
  })

  g.set('cpp_method_call', (node, ctx) => {
    const obj = node.properties.obj ?? 'obj'
    const method = node.properties.method ?? 'method'
    const args = (node.children.args ?? []).map(a => generateExpression(a, ctx))
    return `${indent(ctx)}${obj}.${method}(${args.join(', ')});\n`
  })

  // OOP concepts
  g.set('cpp_class_def', (node, ctx) => {
    const name = node.properties.name ?? 'MyClass'
    const baseClass = node.properties.base_class ?? ''
    const baseAccess = node.properties.base_access ?? 'public'
    const publicBody = node.children.public ?? []
    const protectedBody = node.children.protected ?? []
    const privateBody = node.children.private ?? []
    const inheritance = baseClass ? ` : ${baseAccess} ${baseClass}` : ''
    let code = `${indent(ctx)}class ${name}${inheritance}${openBrace(ctx)}\n`
    if (publicBody.length > 0) {
      code += `${indent(ctx)}public:\n`
      code += generateBody(publicBody, indented(ctx))
    }
    if (protectedBody.length > 0) {
      code += `${indent(ctx)}protected:\n`
      code += generateBody(protectedBody, indented(ctx))
    }
    if (privateBody.length > 0) {
      code += `${indent(ctx)}private:\n`
      code += generateBody(privateBody, indented(ctx))
    }
    code += `${indent(ctx)}};\n`
    return code
  })

  const formatParams = (paramChildren: { properties: Record<string, unknown> }[]) =>
    paramChildren.map(p => {
      const t = String(p.properties.type ?? 'int')
      const n = String(p.properties.name ?? '')
      return n ? `${t} ${n}` : t
    }).join(', ')

  g.set('cpp_constructor', (node, ctx) => {
    const className = node.properties.class_name ?? 'MyClass'
    const paramChildren = node.children.params ?? []
    const initList = node.properties.init_list ?? ''
    const body = node.children.body ?? []
    const paramStr = formatParams(paramChildren)
    const initStr = initList ? ` : ${initList}` : ''
    const header = `${indent(ctx)}${className}(${paramStr})${initStr}${openBrace(ctx)}\n`
    trackOwnText(ctx, header)
    let code = header
    code += generateBody(body, indented(ctx))
    code += `${indent(ctx)}}\n`
    return code
  })

  g.set('cpp_destructor', (node, ctx) => {
    const className = node.properties.class_name ?? 'MyClass'
    const body = node.children.body ?? []
    const header = `${indent(ctx)}~${className}()${openBrace(ctx)}\n`
    trackOwnText(ctx, header)
    let code = header
    code += generateBody(body, indented(ctx))
    code += `${indent(ctx)}}\n`
    return code
  })

  g.set('cpp_virtual_method', (node, ctx) => {
    const returnType = node.properties.return_type ?? 'void'
    const name = node.properties.name ?? 'method'
    const paramChildren = node.children.params ?? []
    const body = node.children.body ?? []
    const paramStr = formatParams(paramChildren)
    const header = `${indent(ctx)}virtual ${returnType} ${name}(${paramStr})${openBrace(ctx)}\n`
    trackOwnText(ctx, header)
    let code = header
    code += generateBody(body, indented(ctx))
    code += `${indent(ctx)}}\n`
    return code
  })

  g.set('cpp_pure_virtual', (node, ctx) => {
    const returnType = node.properties.return_type ?? 'void'
    const name = node.properties.name ?? 'method'
    const paramChildren = node.children.params ?? []
    const paramStr = formatParams(paramChildren)
    return `${indent(ctx)}virtual ${returnType} ${name}(${paramStr}) = 0;\n`
  })

  g.set('cpp_override_method', (node, ctx) => {
    const returnType = node.properties.return_type ?? 'void'
    const name = node.properties.name ?? 'method'
    const paramChildren = node.children.params ?? []
    const body = node.children.body ?? []
    const paramStr = formatParams(paramChildren)
    const header = `${indent(ctx)}${returnType} ${name}(${paramStr}) override${openBrace(ctx)}\n`
    trackOwnText(ctx, header)
    let code = header
    code += generateBody(body, indented(ctx))
    code += `${indent(ctx)}}\n`
    return code
  })

  g.set('cpp_operator_overload', (node, ctx) => {
    const returnType = node.properties.return_type ?? 'void'
    const op = node.properties.operator ?? '+'
    const paramType = node.properties.param_type ?? ''
    const paramName = node.properties.param_name ?? ''
    const body = node.children.body ?? []
    const paramStr = paramType ? (paramName ? `${paramType} ${paramName}` : paramType) : ''
    const header = `${indent(ctx)}${returnType} operator${op}(${paramStr})${openBrace(ctx)}\n`
    trackOwnText(ctx, header)
    let code = header
    code += generateBody(body, indented(ctx))
    code += `${indent(ctx)}}\n`
    return code
  })
}
