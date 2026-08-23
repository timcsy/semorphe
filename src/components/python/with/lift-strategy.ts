/**
 * `python:with` 的 **lift** 路——`with open(p) as f:`。
 *
 * ```
 * with_statement
 *   with_clause
 *     with_item        ← value 欄位是那個運算式（含 `as` 的話是一個 as_pattern）
 *   block
 * ```
 *
 * ⚠️ **多個項目（`with A() as a, B() as b:`）回 `null`**：積木上只有一格，
 * 而自動拆成兩層巢狀等於**改寫使用者的結構**——那不是投影，那是重寫。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'
import type { SemanticNode } from '../../../core/types'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:lift_with', (node, ctx) => {
    const clause = node.namedChildren.find((c) => c.type === 'with_clause')
    const body = node.childForFieldName('body')
    if (!clause || !body) return null
    const items = clause.namedChildren.filter((c) => c.type === 'with_item')
    if (items.length !== 1) return null

    // `with_item` 的 value 欄位：有 `as` 時是 `as_pattern`（左邊是運算式、右邊是名字）
    const inner = items[0].childForFieldName('value') ?? items[0].namedChildren[0]
    if (!inner) return null
    let exprNode = inner
    let name = ''
    if (inner.type === 'as_pattern') {
      exprNode = inner.namedChildren[0]
      // ⚠️ **別名包在 `as_pattern_target` 裡**（實測 2026-08-23）——
      //    直接讀 `alias` 欄位拿到的是那一層，名字在它底下。
      const target = inner.childForFieldName('alias') ?? inner.namedChildren[1]
      if (!target) return null
      const ident = target.type === 'identifier' ? target : target.namedChildren[0]
      // 只收「一個裸名字」——`as (a, b)` 拆開來的形狀積木上放不下
      if (!ident || ident.type !== 'identifier') return null
      name = ident.text
      if (!name) return null
    }
    const value = ctx.lift(exprNode)
    if (!value) return null
    const stmts: SemanticNode[] = []
    for (const s of body.namedChildren) {
      const lifted = ctx.lift(s)
      if (lifted) stmts.push(lifted)
    }
    return createNode('python:with', { name }, { value: [value], body: stmts })
  })
}
