/** `cpp:class_def` 的 **lift** 路——一個只產一種身分的具名策略。
 * ⚠️ 這顆是**閉包提升之後才搬得動的**。 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'
import { liftClassMember } from '../../../languages/cpp/core/lifters/strategies'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  // class_specifier: class Name : public Base { public: ... private: ... protected: ... };
    registry.register('cpp:liftClassDef', (node, ctx) => {
      const nameNode = node.childForFieldName('name')
      const className = nameNode?.text ?? 'MyClass'
      const bodyNode = node.childForFieldName('body')

      // Extract base class from base_class_clause
      const baseClause = node.namedChildren.find(c => c.type === 'base_class_clause')
      let baseClass = ''
      let baseAccess = 'public'
      if (baseClause) {
        // base_class_clause contains access_specifier? and type_identifier
        for (const child of baseClause.namedChildren) {
          if (child.type === 'access_specifier') {
            baseAccess = child.text.replace(/:$/, '').trim()
          } else if (child.type === 'type_identifier' || child.type === 'qualified_identifier') {
            baseClass = child.text
          }
        }
      }

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
      if (baseClass) {
        props.base_class = baseClass
        props.base_access = baseAccess
      }

      return createNode('cpp:class_def', props, {
        public: publicMembers,
        protected: protectedMembers,
        private: privateMembers,
      })
    })
}
