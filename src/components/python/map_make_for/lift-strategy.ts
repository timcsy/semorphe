/**
 * `python:map_make_for` 的 **lift** 路。
 *
 * ```
 * dictionary_comprehension [body]  «{k: v for k, v in d.items()}»
 *   pair [key,value]                 ← body：每一格的鍵與值
 *   for_in_clause [left,right]       ← 名字（可能是 pattern_list）＋ 來源
 *   if_clause                        ← 可選
 * ```
 *
 * 🔴 巢狀與多個 `if` 整顆走誠實降級——與同族的串列生成式同一個理由。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:liftMapMakeFor', (node, ctx) => {
    const fors = node.namedChildren.filter((c) => c.type === 'for_in_clause')
    if (fors.length !== 1) return null
    const ifs = node.namedChildren.filter((c) => c.type === 'if_clause')
    if (ifs.length > 1) return null

    const body = node.childForFieldName('body')
    if (body?.type !== 'pair') return null

    const left = fors[0].childForFieldName('left')
    const names = left?.type === 'pattern_list'
      ? left.namedChildren.filter((c) => c.type === 'identifier').map((c) => c.text)
      : left?.type === 'identifier' ? [left.text] : []
    if (names.length === 0) return null

    const key = ctx.lift(body.childForFieldName('key')!)
    const value = ctx.lift(body.childForFieldName('value')!)
    const src = fors[0].childForFieldName('right')
    const iter = src ? ctx.lift(src) : null
    if (!key || !value || !iter) return null
    const condNode = ifs[0]?.namedChildren[0]
    const cond = condNode ? ctx.lift(condNode) : null

    const children: Record<string, SemanticNode[]> = {
      targets: names.map((n) => createNode('param_decl', { type: '', name: n })),
      key: [key], value: [value], iterable: [iter],
    }
    if (cond) children.condition = [cond]
    return createNode('python:map_make_for', {}, children)
  })
}
