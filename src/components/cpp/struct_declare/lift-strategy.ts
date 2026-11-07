/** `cpp:struct_declare` 的 **lift** 路——一個只產一種身分的具名策略。
 * ⚠️ 這顆是**閉包提升之後才搬得動的**。 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'
import { liftClassMember } from '../../../languages/cpp/lang/lifters/strategies'
import { parseBaseClause } from '../../../languages/cpp/base-clause'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  // struct_specifier: struct Name { members };
    registry.register('cpp:liftStructDef', (node, ctx) => {
      const nameNode = node.childForFieldName('name')
      const structName = nameNode?.text ?? 'MyStruct'
      const bodyNode = node.childForFieldName('body')
      // 🔴 沒有本體 ＝ 前置宣告（`class Account;`）——不是一個空的定義。原本照樣建出元件，產回去是 `class Account { };`，
      //    後面真正的定義就成了重複定義（產碼編不過、Cella 判 redeclared；2026-11-06 元件管線 311 的盲測，三支）。
      //    🟢 2026-11-06（元件管線 313）：獨立成一句的前置宣告由「類別的前置宣告」那一顆以較高的優先序認領——走到這裡的是它讓開的
      //    （樣板的前置宣告 `template <class T> class X;` 等）⟹ 照實降級（原文照抄；Cella 那側標翻不出）。
      if (!bodyNode) {
        // ⚠️ 分號在 class_specifier 外面（它是外層那一句的）——讓開的話照抄的原文是 `class Account`，產回去少了分號就編不過。
        //    所以自己建降級節點：原文連同後面那個分號
        const sibs = node.parent?.children ?? []
        const semi = sibs[sibs.findIndex((c) => c.startIndex === node.startIndex) + 1]?.type === ';' ? ';' : ''
        const raw = createNode('raw_code', {})
        raw.metadata = { rawCode: `${node.text}${semi}`, confidence: 'raw_code', degradationCause: 'unsupported' }
        return raw
      }
      // 基底（spec 209）：多重／virtual 繼承這顆裝不下 ⟹ 讓開，照實降級（不留半套）
      const base = parseBaseClause(node)
      if (base === 'unsupported') return null
      // `class A final`（spec 209）：沒有元件記得住 final ⟹ 讓開，照實降級
      if (node.namedChildren.some((c) => c.type === 'virtual_specifier' && c.text === 'final')) return null
      const members: SemanticNode[] = []

      if (bodyNode) {
        for (const child of bodyNode.namedChildren) {
          if (child.type === 'access_specifier') continue
          const lifted = liftClassMember(child, structName, ctx)
          if (lifted) members.push(lifted)
        }
      }

      const props: Record<string, string> = { name: structName }
      if (base) { props.base_class = base.base; props.base_access = base.access }
      return createNode('cpp:struct_declare', props, { members })
    })
}

/**
 * C 的 `typedef struct [Tag] { … } Alias;`——typedef 那顆的 lift 把帶本體的 struct 交給上面的策略，再呼叫這個記別名
 * （2026-11-08，C 盲測：原本這一句整個照原文降級，C 最常見的寫法判不出來）。
 * 身分只寫在這顆膠囊裡：別的膠囊問「這是不是一顆 struct」用這個，不寫 `cpp:struct_declare`。
 * 匿名（`typedef struct { … } Point;`）的 name 留空——不再編 `MyStruct`。不是 struct 的回 null。
 */
export function asTypedefStruct(lifted: SemanticNode | null, alias: string, anonymous: boolean): SemanticNode | null {
  if (!lifted || lifted.componentId !== 'cpp:struct_declare') return null
  return { ...lifted, properties: { ...lifted.properties, name: anonymous ? '' : lifted.properties.name, typedef_alias: alias } }
}
