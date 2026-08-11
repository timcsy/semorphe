import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { generateExpression, generateBody } from '../../../../core/projection/code-generator'

export function registerDeclarationGenerators(g: Map<string, NodeGenerator>): void {














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
