import type { NodeGenerator } from '../../../../core/projection/code-generator'
import { generateBody, indent } from '../../../../core/projection/code-generator'

export function registerDeclarationGenerators(g: Map<string, NodeGenerator>): void {














  // ⚠️ `cpp:initializer_list` 的產生器**已搬進膠囊**（2026-08-14 升格成元件）。

































  g.set('_multi_field', (node, ctx) => {
    const fields = node.slots.fields ?? []
    /**
     * 🔴 **`int x, y;` 要產回成一行**（2026-09-18，語料的 round-trip 探針量到）。
     *
     * 攤成兩行是**合法而且行為相同**的 C++，所以 ①④⑤ 三個面向都是綠的
     * ——紅的是 **② 語義的不動點**：再 lift 一次就不是同一棵樹了
     *（一顆 `_multi_field` 變成兩顆平行的宣告）。
     *
     * > **一個只在「再走一趟」時才看得出來的差別，
     * > 每一個只走一趟的檢查都會是綠的。**
     *
     * ⚠️ 只在**每一格的型別相同而且都沒有初始值**時併回去——
     * `int *p, q;` 的兩格型別不同（星號屬於型別），硬併會產出另一支程式。
     */
    const types = fields.map((f) => String(f.properties.type ?? ''))
    const plain = fields.length > 1
      && types.every((t) => t === types[0] && t !== '')
      && fields.every((f) => (f.slots.initializer ?? []).length === 0)
    if (plain) {
      const names = fields.map((f) => String(f.properties.name ?? '')).join(', ')
      return `${indent(ctx)}${types[0]} ${names};\n`
    }
    return generateBody(fields, ctx)
  })
}
