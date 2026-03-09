import type { StylePreset } from '../../../core/types'
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerIOGenerators(g: Map<string, NodeGenerator>, style: StylePreset): void {
  g.set('print', (node, ctx) => {
    const values = node.children.values ?? []
    if (style.io_style === 'cout') {
      const parts = values.map(v => generateExpression(v, ctx))
      return `${indent(ctx)}cout << ${parts.join(' << ')};\n`
    }
    // printf mode: embed string_literal values into format, use %d for expressions
    const hasEndl = values.some(v => v.concept === 'endl')
    const fmtParts: string[] = []
    const argParts: string[] = []
    for (const v of values) {
      if (v.concept === 'endl') continue
      if (v.concept === 'string_literal') {
        fmtParts.push((v.properties.value as string) ?? '')
      } else {
        fmtParts.push('%d')
        argParts.push(generateExpression(v, ctx))
      }
    }
    if (fmtParts.length === 0 && hasEndl) {
      return `${indent(ctx)}printf("\\n");\n`
    }
    const fmt = fmtParts.join('') + (hasEndl ? '\\n' : '')
    if (argParts.length > 0) {
      return `${indent(ctx)}printf("${fmt}", ${argParts.join(', ')});\n`
    }
    return `${indent(ctx)}printf("${fmt}");\n`
  })

  g.set('input', (node, ctx) => {
    // Support both: children.values (var_ref nodes) and properties.variable (legacy)
    const valueNodes = node.children.values ?? []
    let vars: string[]
    if (valueNodes.length > 0) {
      vars = valueNodes.map(v => generateExpression(v, ctx))
    } else {
      vars = (node.properties.variables as string[] | undefined) ?? [node.properties.variable ?? 'x']
    }
    if (style.io_style === 'cout') {
      const expr = `cin >> ${vars.join(' >> ')}`
      if (ctx.isExpression) return expr
      return `${indent(ctx)}${expr};\n`
    }
    if (ctx.isExpression) {
      // scanf in expression context (rare but handle gracefully)
      return vars.length === 1 ? `scanf("%d", &${vars[0]})` : `scanf("%d", &${vars.join(', &')})`
    }
    return vars.map(v => `${indent(ctx)}scanf("%d", &${v});\n`).join('')
  })

  g.set('endl', (_node, _ctx) => 'endl')

  // c_printf with structured args (0 or more)
  g.set('cpp_printf', (node, ctx) => {
    const format = (node.properties.format as string) ?? '%d\\n'
    const argNodes = node.children.args ?? []
    if (argNodes.length > 0) {
      const args = argNodes.map(a => generateExpression(a, ctx))
      return `${indent(ctx)}printf("${format}", ${args.join(', ')});\n`
    }
    // 0 args or legacy: just format string
    const argsText = (node.properties.args as string) ?? ''
    if (argsText) return `${indent(ctx)}printf("${format}"${argsText});\n`
    return `${indent(ctx)}printf("${format}");\n`
  })

  // c_scanf with structured args + auto & for simple vars (0 or more)
  g.set('cpp_scanf', (node, ctx) => {
    const format = (node.properties.format as string) ?? '%d'
    const argNodes = node.children.args ?? []
    if (argNodes.length > 0) {
      const args = argNodes.map(a => {
        const expr = generateExpression(a, ctx)
        // var_ref nodes need & prefix (unless array/string/pointer)
        if (a.concept === 'var_ref' && !a.properties.noAddr) {
          return `&${expr}`
        }
        // no-addr var_ref, or compose/custom: user already controls &
        return expr
      })
      return `${indent(ctx)}scanf("${format}", ${args.join(', ')});\n`
    }
    const argsText = (node.properties.args as string) ?? ''
    return `${indent(ctx)}scanf("${format}"${argsText});\n`
  })
}
