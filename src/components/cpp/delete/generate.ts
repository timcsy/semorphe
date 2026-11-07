/** `cpp:delete` 的 **generate** 路——`delete p;` 或 `delete[] p;`（屬性 `is_array`，第 331 刀：原本 `[]` 產不回來） */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent, generateExpression } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:delete', (node, ctx) => {
      const ptr = generateExpression((node.slots.ptr ?? [])[0], ctx)
      return `${indent(ctx)}delete${String(node.properties.is_array ?? 'false') === 'true' ? '[]' : ''} ${ptr};\n`
    })
}
