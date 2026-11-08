/**
 * `cpp:union_declare` 的 **lift** 路（2026-11-08，C 盲測第二輪）：`union U { int i; char c; };`。
 * 照同族的結構定義抄：成員逐一交給共用的類別成員 lift。沒有本體的（`union U;`）、帶成員函式或建構子的（C++）、匿名的照實降級。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'
import { liftClassMember } from '../../../languages/cpp/lang/lifters/strategies'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('cpp:liftUnionDef', (node, ctx) => {
    const name = node.childForFieldName('name')?.text ?? ''
    const body = node.childForFieldName('body')
    // 匿名的只在 typedef 裡收（`typedef union { … } Num;`）；結構裡的匿名 union 成員直接掛在外層——還裝不下
    if (!body || (!name && node.parent?.type !== 'type_definition')) return null
    const members: SemanticNode[] = []
    for (const child of body.namedChildren) {
      if (child.type === 'comment') { const c = ctx.lift(child); if (c) members.push(c); continue }
      // 成員函式、建構子、存取標示：還沒有對應——整個 union 照原文降級
      if (child.type !== 'field_declaration' || child.namedChildren.some((g) => g.type === 'function_declarator')) return null
      const lifted = liftClassMember(child, name, ctx)
      if (!lifted) return null
      members.push(lifted)
    }
    return createNode('cpp:union_declare', { name }, { members })
  })
}

/**
 * `typedef union [Tag] { … } Alias;`：typedef 那顆的 lift 把帶本體的 union 交給上面的策略，再呼叫這個記別名（同結構那顆的 asTypedefStruct）。
 * 匿名的（`typedef union { … } Num;`）name 留空。不是 union 的回 null。
 */
export function asTypedefUnion(lifted: SemanticNode | null, alias: string, anonymous: boolean): SemanticNode | null {
  if (!lifted || lifted.componentId !== 'cpp:union_declare') return null
  return { ...lifted, properties: { ...lifted.properties, name: anonymous ? '' : lifted.properties.name, typedef_alias: alias } }
}
