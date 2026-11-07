/** `cpp:var_declare_const` 的 **generate** 路——從共用檔原封剪過來（批次第二十二批：修飾詞 → 身分的登錄）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:var_declare_const', (node, ctx) => {
      const type = node.properties.type ?? 'int'
      const name = node.properties.name ?? 'MAX'
      const inits = node.slots.initializer ?? []
      // 建構子形式（`const Vec k(5, 6);`）：每一個引數照原樣（第 331 刀：原本只寫第一個、而且寫成 `= 5`）
      if (node.properties.init_style === 'constructor') {
        return `${indent(ctx)}const ${type} ${name}(${inits.map((x) => generateExpression(x, ctx)).join(', ')});\n`
      }
      if (inits.length > 0) {
        const val = generateExpression(inits[0], ctx)
        return `${indent(ctx)}const ${type} ${name} = ${val};\n`
      }
      return `${indent(ctx)}const ${type} ${name};\n`
    })
}
