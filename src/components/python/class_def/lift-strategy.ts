/**
 * `python:class_def` 的 **lift** 路。
 *
 * 🔴 **兩種情況整顆走誠實降級**（見 `component.json`）：
 * 有繼承（`class Dog(Animal)`）、或類別層級的屬性（`count = 0`）。
 * 收一半會產出一個**合法而行為不同**的類別。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('python:liftClassDef', (node, ctx) => {
    // 🟢 **繼承收得下**（2026-08-22）：`superclasses` 是一個 `argument_list`，
    //    而教學語料裡它一律只有一個名字。多重繼承（兩個以上）或
    //    不是裸名字的（`class D(Base[int])`）→ 整顆降級。
    const supers = node.namedChildren.find((c) => c.type === 'argument_list')
    let base = ''
    if (supers) {
      const args = supers.namedChildren
      if (args.length !== 1 || args[0].type !== 'identifier') return null
      base = args[0].text
    }

    const body = node.childForFieldName('body')
    const members = body?.namedChildren ?? []
    // 只收方法。其餘（類別層級的屬性、巢狀類別）→ 整顆降級
    if (members.some((m) => m.type !== 'function_definition')) return null

    const methods: SemanticNode[] = []
    for (const m of members) {
      const lifted = ctx.lift(m)
      if (!lifted) return null // 有一個方法認不出來 → 整顆降級，不產出少了方法的類別
      methods.push(lifted)
    }
    return createNode('python:class_def', { name: node.childForFieldName('name')?.text ?? 'MyClass', base }, { methods })
  })
}
