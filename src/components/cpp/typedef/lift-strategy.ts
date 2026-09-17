/** `cpp:typedef` 的 **lift** 路——一個只產一種身分的具名策略，原本是
 * `core/lifters/strategies.ts` 的 `registry.register('cpp:liftTypedef', …)`。 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import { createNode } from '../../../core/semantic-tree'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  // type_definition: typedef int myint; → cpp_typedef
    registry.register('cpp:liftTypedef', (node) => {
      // ⚠️ **`template_type` 也要認**（2026-09-17）：`typedef pair<int,int> P;`
      //    少了它，原型別被讀成第一個 `type_identifier`——而那是 `P` 自己，
      //    於是這個別名指向它自己。**一個自我指涉的別名不會報錯，它只是什麼都沒說。**
      const typeNode = node.namedChildren.find(c =>
        c.type === 'primitive_type' || c.type === 'type_identifier' ||
        c.type === 'qualified_identifier' || c.type === 'sized_type_specifier' ||
        c.type === 'template_type'
      )
      const aliasNode = node.namedChildren.find(c => c.type === 'type_identifier' &&
        (c.startPosition.row !== typeNode?.startPosition.row || c.startPosition.column !== typeNode?.startPosition.column)
      )
      const origType = typeNode?.text ?? 'int'
      const alias = aliasNode?.text ?? 'mytype'
      return createNode('cpp:typedef', { orig_type: origType, alias })
    })
}
