/**
 * `cpp:struct_at_member` 的 **lift** 路——**`field_expression` 的一個分支**
 *
 * ⚠️ 兩顆的判別**都寫成具體的**（有 `->` ／ 沒有 `->`），不是一個具體、
 * 一個「其餘」。登錄順序來自檔名排序，那不是任何人設計的。
 *
 * ## 🔴 `obj` 是一個字串，而它裝得下不是名字的東西
 *
 * `v[0].first` 的 `obj` 被寫成字串 `"v[0]"`，而執行器拿它去 `ctx.scope.get()`
 * ——查不到，丟 `UNDECLARED_VAR: v[0]`。第三十二條護欄的 1 段缺口。
 *
 * `cpp:var_assign` 的執行器早就記過同一個形狀：「**辨識器把它編成一個帶點號的
 * 名字**（`name: "p.x"`），不是拆開的 `{ name: 'p', member: 'x' }`……
 * 字串編碼結構是既有的技術債（同 `func_def` 的參數），不在這一刀的範圍。」
 *
 * → 這一刀把它接起來：**`obj` 不是單純的識別字時，掛成一個接點**。
 * ⚠️ 而字串屬性**保留**——它是既有生產者與產生器在讀的東西，
 * 一次拔掉會讓一整批來回轉換掉一段。兩者並存，執行器**先問接點**。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'
import { registerAstBranch } from '../../../core/component/lift-branches'

export function registerLift(): void {
  // 🪦 **「我可以被寫回」的宣告已於 2026-08-25 搬到 `execute.ts`**——
  //    它從一個 `kind` 字串變成一個**解析函式**，而函式要用到執行環境。
  registerAstBranch('field_expression', 'cpp/struct_at_member', (node, ctx): SemanticNode | null => {
    // `s.member`——**沒有 `->` 時是我**（判別寫成具體的，不是「其餘」）
    if (node.children.find((c) => c.type === '->')) return null
    const argNode = node.childForFieldName('argument')
    const props = {
      obj: argNode?.text ?? '',
      member: node.childForFieldName('field')?.text ?? '',
    }
    // 單純的識別字（`p.first`）走既有的字串路徑；其餘（`v[0].first`、
    // `f().x`）掛成接點——⚠️ **判別看 AST 的節點型別，不 parse 那個字串**。
    if (argNode && argNode.type !== 'identifier') {
      const lifted = ctx.lift(argNode)
      if (lifted) return createNode('cpp:struct_at_member', props, { obj: [lifted] })
    }
    return createNode('cpp:struct_at_member', props)
  })
}
