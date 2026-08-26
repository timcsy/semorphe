/** `cpp:forward_decl` 的 **generate** 路——從共用檔原封剪過來（批次第十九批：單一建立點的建構子）。 */
import type { NodeGenerator } from '../../../core/projection/code-generator'
import { indent } from '../../../core/projection/code-generator'

export function registerGenerate(g: Map<string, NodeGenerator>): void {
  g.set('cpp:forward_decl', (node, ctx) => {
      const returnType = node.properties.return_type ?? 'void'
      const name = node.properties.name ?? ''
      const paramChildren = node.children.params ?? []
      const paramStr = paramChildren.map(p => {
        const t = String(p.properties.type ?? 'int')
        const n = String(p.properties.name ?? '')
        // 🔴 **預設值要跟著印**（2026-08-26 補）——少了它，`add(1)` 這個合法的呼叫
        //    會變成「少了引數」，而**產出的碼編不過**。
        //    ⚠️ 而在 C++ 裡預設值的家**正是前置宣告**（有定義時不准重複寫）
        //    ——所以這一顆掉了它，比函式定義那顆掉了它更嚴重。
        //    🪦 那一顆 2026-08-23 就補好了（逐字相同的三行），而**這一顆沒有**。
        const d = String(p.properties.default ?? '')
        const tail = d ? ` = ${d}` : ''
        if (t.endsWith('[]')) {
          const baseType = t.slice(0, -2)
          return n ? `${baseType} ${n}[]${tail}` : `${baseType}[]`
        }
        return n ? `${t} ${n}${tail}` : t
      }).join(', ')
      return `${indent(ctx)}${returnType} ${name}(${paramStr});\n`
    })
}
