/**
 * `python:lambda` 的 **lift** 路。
 *
 * ⚠️ 參數在 `lambda_parameters` 裡，而**沒有參數時那個節點整個不存在**
 * （`lambda: 1`）——所以要找而不是取欄位。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:liftLambda', (node, ctx) => {
    const ps = node.namedChildren.find((c) => c.type === 'lambda_parameters')
    const params = []
    for (const p of ps?.namedChildren ?? []) {
      // 預設值／`*args` 還沒收 —— 整顆降級，不產出一個少了東西的匿名函式
      if (p.type !== 'identifier') return null
      params.push(createNode('param_decl', { type: '', name: p.text }))
    }
    const bodyNode = node.childForFieldName('body')
    const body = bodyNode ? ctx.lift(bodyNode) : null
    if (!body) return null
    return createNode('python:lambda', {}, { params, body: [body] })
  })
}
