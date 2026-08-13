/**
 * `cpp:new` 的 **lift** 路——一個只產一種身分的具名策略，原本是
 * `core/lifters/strategies.ts` 的 `registry.register('cpp:liftNewExpression', …)`。
 *
 * ## ⚠️ `new int[n]` 的 `[n]` 原本整個掉了
 *
 * 這裡只抓 `argument_list`（`new int(5)` 的建構引數），而**陣列大小是
 * `new_declarator`**，不在那個分支裡。於是：
 *
 * ```
 * new int[n]   → cpp:new { type: 'int', args: '' }   ← [n] 不見了
 * new int      → cpp:new { type: 'int', args: '' }   ← 與上面完全相同
 * ```
 *
 * 🔴 **兩個不同的東西產出同一棵樹**，而產生器也只寫得出 `new int`
 * ——**辨識掉、產生也掉，對稱**，所以來回轉換比對一直是綠的。
 * 這是同一天內遇到的第二個對稱遺失（第一個是 `pair` 的初始值）。
 *
 * > **一個對稱的資料遺失不會讓任何比對變紅——它只會讓執行結果變成別的程式。**
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('cpp:liftNewExpression', (node, ctx) => {
    const typeNode = node.namedChildren.find(c =>
      c.type === 'type_identifier' || c.type === 'primitive_type' || c.type === 'sized_type_specifier'
    )
    const type = typeNode?.text ?? 'int'
    const argList = node.namedChildren.find(c => c.type === 'argument_list')
    const args = argList ? argList.namedChildren.map(a => a.text).join(', ') : ''

    // `new int[n]` —— 大小住在 `new_declarator` 裡（`[` 運算式 `]`）。
    const declarator = node.namedChildren.find(c => c.type === 'new_declarator')
    const sizeExpr = declarator?.namedChildren[0]
    const size = sizeExpr ? ctx.lift(sizeExpr) : null

    return size
      ? createNode('cpp:new', { type, args }, { size: [size] })
      : createNode('cpp:new', { type, args })
  })
}
