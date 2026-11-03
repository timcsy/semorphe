/** `cpp:class_def` 的 **lift** 路——一個只產一種身分的具名策略。
 * ⚠️ 這顆是**閉包提升之後才搬得動的**。 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'
import { liftClassMember } from '../../../languages/cpp/lang/lifters/strategies'
import { parseBaseClause } from '../../../languages/cpp/base-clause'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  // class_specifier: class Name : public Base { public: ... private: ... protected: ... };
    registry.register('cpp:liftClassDef', (node, ctx) => {
      const nameNode = node.childForFieldName('name')
      const className = nameNode?.text ?? 'MyClass'
      const bodyNode = node.childForFieldName('body')

      // 基底（spec 209：共用的解析；沒寫存取是 implicit——class 的預設是 private，原本被記成 public）。多重／virtual 繼承照實降級
      const base = parseBaseClause(node)
      if (base === 'unsupported') return null

      const publicMembers: SemanticNode[] = []
      const privateMembers: SemanticNode[] = []
      const protectedMembers: SemanticNode[] = []
      let currentAccess = 'private' // default access in class

      if (bodyNode) {
        for (const child of bodyNode.namedChildren) {
          if (child.type === 'access_specifier') {
            const accessText = child.text.replace(/:$/, '').trim()
            currentAccess = accessText
            continue
          }
          const lifted = liftClassMember(child, className, ctx)
          if (lifted) {
            if (currentAccess === 'public' || currentAccess === 'public:') publicMembers.push(lifted)
            else if (currentAccess === 'protected' || currentAccess === 'protected:') protectedMembers.push(lifted)
            else privateMembers.push(lifted)
          }
        }
      }

      const props: Record<string, string> = { name: className }
      if (base) {
        props.base_class = base.base
        props.base_access = base.access
      }

      return createNode('cpp:class_def', props, {
        public: publicMembers,
        protected: protectedMembers,
        private: privateMembers,
      })
    })
}
