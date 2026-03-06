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
    const parts = values.map(v => generateExpression(v, ctx))
    return `${indent(ctx)}printf("%d", ${parts.join(', ')});\n`
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
      return `${indent(ctx)}cin >> ${vars.join(' >> ')};\n`
    }
    return vars.map(v => `${indent(ctx)}scanf("%d", &${v});\n`).join('')
  })

  g.set('endl', (_node, _ctx) => 'endl')
}
