import type { StylePreset } from '../../../../core/types'
import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../../core/projection/code-generator'

export function registerCstdioGenerators(g: Map<string, NodeGenerator>, _style: StylePreset): void {
  // c_printf with structured args (0 or more)
  g.set('cpp:printf', (node, ctx) => {
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
  g.set('cpp:scanf', (node, ctx) => {
    const format = (node.properties.format as string) ?? '%d'
    const argNodes = node.children.args ?? []
    if (argNodes.length > 0) {
      const args = argNodes.map(a => {
        const expr = generateExpression(a, ctx)
        // var_ref nodes need & prefix (unless array/string/pointer)
        if (a.conceptId === 'lang:var_ref' && !a.properties.noAddr) {
          return `&${expr}`
        }
        // no-addr var_ref, or compose/custom: user already controls &
        return expr
      })
      const expr = `scanf("${format}", ${args.join(', ')})`
      if (ctx.isExpression) return expr
      return `${indent(ctx)}${expr};\n`
    }
    const argsText = (node.properties.args as string) ?? ''
    const expr = `scanf("${format}"${argsText})`
    if (ctx.isExpression) return expr
    return `${indent(ctx)}${expr};\n`
  })

  // Expression version of scanf (for use in for-loop init/update)
}
