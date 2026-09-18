/** `cpp:loop_range` 的 **lift** 路——一個只產一種身分的具名策略，原本是
 * `core/lifters/strategies.ts` 的 `registry.register('cpp:liftRangeFor', …)`。 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { AstNode } from '../../../core/lift/types'
import { createNode } from '../../../core/semantic-tree'
import { extractBody } from '../../../languages/cpp/lang/lifters/strategies'

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  // for_range_loop: for (auto x : vec) { body }
    registry.register('cpp:liftRangeFor', (node, ctx) => {
      const qualifierNode = node.namedChildren.find(c => c.type === 'type_qualifier')
      const typeNode = node.namedChildren.find(c =>
        c.type === 'primitive_type' || c.type === 'type_identifier' ||
        c.type === 'placeholder_type_specifier' || c.type === 'template_type'
      )
      // Handle reference/pointer declarators: for (const string& w : container)
      // In this case, the loop var `w` lives inside reference_declarator, not as a bare identifier
      const refDeclNode = node.namedChildren.find(c =>
        c.type === 'reference_declarator' || c.type === 'pointer_declarator'
      )
      /**
       * 🔴 **迴圈變數可能是【一串名字】**（`for (auto [w, to] : ar[P])`，2026-09-18）。
       *
       * 在此之前這裡走下面那條 `find(identifier)`——而一串名字不是 identifier，
       * 於是它**找到了容器的名字**：`var_name` 與 `container` 兩格一模一樣。
       * 症狀是迴圈裡的 `w`／`to` 說「沒有宣告過這個名字」，而容器被重新綁定。
       *
       * 🟢 做法與另一個語言的同族迴圈一致：**多目標走 `targets` 子節點，
       * 而 `var_name` 留著當它的第一格**——舊存檔照樣打得開，
       * 而積木上那個名字欄位也還在用它。兩者不是兩份真相。
       *
       * ⚠️ `param_decl` 是核心的共用結構節點（函式參數也用它），不是某顆膠囊的身分。
       */
      const bindNode = node.namedChildren.find(c => c.type === 'structured_binding_declarator')
        ?? refDeclNode?.namedChildren.find((c: AstNode) => c.type === 'structured_binding_declarator')
      const boundNames = bindNode
        ? bindNode.namedChildren.filter((c: AstNode) => c.type === 'identifier').map((c: AstNode) => c.text)
        : []

      let varNode: AstNode | null
      if (bindNode) {
        varNode = bindNode.namedChildren.find((c: AstNode) => c.type === 'identifier') ?? null
      } else if (refDeclNode) {
        varNode = refDeclNode.namedChildren.find((c: AstNode) => c.type === 'identifier') ?? null
      } else {
        varNode = node.namedChildren.find(c => c.type === 'identifier') ?? null
      }
      const varName = varNode?.text ?? 'x'
      // Build varType with const qualifier and reference sigil if present
      const baseType = typeNode?.text ?? 'auto'
      const qualifier = qualifierNode?.text ? qualifierNode.text + ' ' : ''
      const refSigil = refDeclNode?.type === 'reference_declarator' ? '&' : refDeclNode?.type === 'pointer_declarator' ? '*' : ''
      const varType = `${qualifier}${baseType}${refSigil}`
      /**
       * 🔴 **走訪的容器是一棵樹，不是一串文字**（2026-09-18）。
       *
       * 在此之前這裡抄 `rightNode.text`，於是 `for (int i : d2[pt])` 的容器
       * 變成字串 `"d2[pt]"`，而執行期拿它去 `scope.get`——
       * 說「沒有宣告過 `d2[pt]`」。**錯誤看起來像學生打錯字。**
       *
       * 🔴 **而那個字串屬性整個退場**——留著它等於留下第二份真相。
       */
      const rightNode = node.childForFieldName('right')
      const iterable = rightNode ? ctx.lift(rightNode) : null
      const bodyNode = node.childForFieldName('body') ?? node.namedChildren.find(c => c.type === 'compound_statement') ?? null
      const body = extractBody(bodyNode, ctx)
      const targets = boundNames.map((n: string) => createNode('param_decl', { type: '', name: n }))
      return createNode(
        'cpp:loop_range',
        { var_type: varType, var_name: varName },
        {
          body,
          ...(iterable ? { iterable: [iterable] } : {}),
          ...(targets.length > 0 ? { targets } : {}),
        },
      )
    })
}
