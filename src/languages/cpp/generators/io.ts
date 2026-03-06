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
    const varName = node.properties.variable ?? 'x'
    if (style.io_style === 'cout') {
      return `${indent(ctx)}cin >> ${varName};\n`
    }
    return `${indent(ctx)}scanf("%d", &${varName});\n`
  })

  g.set('endl', (_node, _ctx) => 'endl')
}
