import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { indent, generateExpression, generateBody } from '../../../../core/projection/code-generator'

export function registerDeclarationGenerators(g: Map<string, NodeGenerator>): void {
  g.set('cpp:var_declare', (node, ctx) => {
    // ⚠️ **位置感知**：`for (int i = 0; …)` 的初始化位置不要分號與縮排。
    // 那是**形態**不是身分——B 項把 `var_declare_expr` 合併進來。
    const 收尾 = (expr: string): string => (ctx.isExpression ? expr : `${indent(ctx)}${expr};\n`)
    const type = node.properties.type ?? 'int'
    const declarators = node.children.declarators ?? []

    // Multi-variable: int x, v1 = 0;
    if (declarators.length > 0) {
      const parts = declarators.map(d => {
        const name = d.properties.name ?? 'x'
        const inits = d.children.initializer ?? []
        if (inits.length > 0) {
          return `${name} = ${generateExpression(inits[0], ctx)}`
        }
        return name
      })
      return 收尾(`${type} ${parts.join(', ')}`)
    }

    // Single variable
    const name = node.properties.name ?? 'x'
    const inits = node.children.initializer ?? []
    if (inits.length > 0) {
      // Constructor-style initialization: Type name(args)
      if (node.properties.init_style === 'constructor') {
        const args = inits.map(a => generateExpression(a, ctx))
        return 收尾(`${type} ${name}(${args.join(', ')})`)
      }
      const val = generateExpression(inits[0], ctx)
      return 收尾(`${type} ${name} = ${val}`)
    }
    return 收尾(`${type} ${name}`)
  })













  // 巢狀初始值列表（多維陣列的一層）——只在 array_declare 的 values 下出現
  g.set('cpp_initializer_list', (node, ctx) => {
    const values = node.children.values ?? []
    return `{${values.map(v => generateExpression(v, ctx)).join(', ')}}`
  })

































  g.set('_multi_field', (node, ctx) => {
    const fields = node.children.fields ?? []
    return generateBody(fields, ctx)
  })
}
