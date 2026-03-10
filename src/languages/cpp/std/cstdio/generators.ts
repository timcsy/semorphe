import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../../core/projection/code-generator'

export function registerCstdioGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {
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

  // Expression version of scanf (for use in for-loop init/update)
  g.set('cpp_scanf_expr', (node, ctx) => {
    const format = (node.properties.format as string) ?? '%d'
    const argNodes = node.children.args ?? []
    if (argNodes.length > 0) {
      const args = argNodes.map(a => {
        const expr = generateExpression(a, ctx)
        if (a.concept === 'var_ref' && !a.properties.noAddr) return `&${expr}`
        return expr
      })
      return `scanf("${format}", ${args.join(', ')})`
    }
    const argsText = (node.properties.args as string) ?? ''
    return `scanf("${format}"${argsText})`
  })
}
