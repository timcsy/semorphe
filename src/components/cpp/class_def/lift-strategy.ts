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
      // 🔴 沒有本體 ＝ 前置宣告（`class Account;`）——不是一個空的定義。原本照樣建出元件，產回去是 `class Account { };`，
      //    後面真正的定義就成了重複定義（產碼編不過、Cella 判 redeclared；2026-11-06 元件管線 311 的盲測，三支）。
      //    還沒有「只宣告、之後再定義」的元件 ⟹ 讓開，照實降級（原文照抄；Cella 那側標翻不出）。路線圖〈類別的前置宣告〉。
      if (!bodyNode) {
        // ⚠️ 分號在 class_specifier 外面（它是外層那一句的）——讓開的話照抄的原文是 `class Account`，產回去少了分號就編不過。
        //    所以自己建降級節點：原文連同後面那個分號
        const sibs = node.parent?.children ?? []
        const semi = sibs[sibs.findIndex((c) => c.startIndex === node.startIndex) + 1]?.type === ';' ? ';' : ''
        const raw = createNode('raw_code', {})
        raw.metadata = { rawCode: `${node.text}${semi}`, confidence: 'raw_code', degradationCause: 'unsupported' }
        return raw
      }

      // 基底（spec 209：共用的解析；沒寫存取是 implicit——class 的預設是 private，原本被記成 public）。多重／virtual 繼承照實降級
      const base = parseBaseClause(node)
      if (base === 'unsupported') return null
      // `class A final`（spec 209）：沒有元件記得住 final ⟹ 讓開，照實降級
      if (node.namedChildren.some((c) => c.type === 'virtual_specifier' && c.text === 'final')) return null

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
