/** `cpp:pointer_declare` 的 **generate** 路——從共用檔原封剪過來（批次第三十批）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'
import { cTypeText } from '../../../languages/cpp/target-dialect'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:pointer_declare', (node, ctx) => {
      // C 目標：`P* p` → `struct P* p`（`_structNames` 只有 C 目標會填，C++ 一個字都不變；357）
      const rawType = String(node.properties.type ?? 'int')
      const type = ctx._structNames ? cTypeText(rawType, ctx._structNames) : rawType
      const name = node.properties.name ?? 'ptr'
      const inits = node.slots.initializer ?? []
      if (inits.length > 0) {
        const val = generateExpression(inits[0], ctx)
        return `${indent(ctx)}${type}* ${name} = ${val};\n`
      }
      return `${indent(ctx)}${type}* ${name};\n`
    })
}
