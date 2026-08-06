import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../../core/projection/code-generator'

export function registerIostreamGenerators(g: Map<string, NodeGenerator>, style: StylePreset): void {
  // Concepts that need parentheses in cout << chain due to lower precedence than <<
  const COUT_NEEDS_PARENS = new Set([
    'cpp_ternary', 'cpp_comma_expr', 'cpp_compound_assign_expr',
  ])
  // Bitwise/comparison/logic operators have lower precedence than <<
  const LOW_PREC_OPS = new Set(['&', '|', '^', '&&', '||', '>', '<', '>=', '<=', '==', '!='])

  function needsParensInCout(v: import('../../../../core/types').SemanticNode): boolean {
    if (COUT_NEEDS_PARENS.has(v.conceptId)) return true
    if ((v.conceptId === 'arithmetic' || v.conceptId === 'compare' || v.conceptId === 'logic') &&
        LOW_PREC_OPS.has(String(v.properties.operator ?? ''))) return true
    return false
  }

  g.set('print', (node, ctx) => {
    const values = node.children.values ?? []
    if (style.io_style === 'cout') {
      const parts = values.map(v => {
        const expr = generateExpression(v, ctx)
        if (needsParensInCout(v)) return `(${expr})`
        return expr
      })
      return `${indent(ctx)}cout << ${parts.join(' << ')};\n`
    }
    // printf mode: embed string_literal values into format, use %d for expressions
    const hasEndl = values.some(v => v.conceptId === 'endl')
    const fmtParts: string[] = []
    const argParts: string[] = []
    for (const v of values) {
      if (v.conceptId === 'endl') continue
      if (v.conceptId === 'string_literal') {
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
    const valueNodes = node.children.values ?? []
    const vars = valueNodes.length > 0
      ? valueNodes.map(v => generateExpression(v, ctx))
      : [String(node.properties.variable ?? 'x')]
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
}
