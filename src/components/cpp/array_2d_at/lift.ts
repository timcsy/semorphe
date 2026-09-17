/**
 * `cpp:array_2d_at` 的 **lift** 路——**`subscript_expression` 的一個分支**
 *
 * ⚠️ **判別寫成完全具體的**，不倚賴「排在第幾個」——分支的登錄順序來自
 * `import.meta.glob` 的檔名排序，那不是任何人設計的。
 */
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'
import { registerAstBranch } from '../../../core/component/lift-branches'

export function registerLift(): void {
  registerAstBranch('subscript_expression', 'cpp/array_2d_at', (node, ctx): SemanticNode | null => {
    // `arr[i][j]`——**外層下標的引數還是下標時是我**
    const arrayNode = node.childForFieldName('argument') ?? node.namedChildren[0]
    if (arrayNode?.type !== 'subscript_expression') return null
    const innerArrayNode = arrayNode.childForFieldName('argument') ?? arrayNode.namedChildren[0]
    /**
     * 🔴 **對照表的外層下標是一個【鍵】，不是一個列**（2026-09-18，盲測抓到）。
     *
     * ```cpp
     * map<int, vector<int>> g;  g[5].push_back(9);  cout << g[5][0];
     * ```
     *
     * 這一條原本純粹看語法（「外層下標的引數還是下標時是我」），於是
     * `g[5][0]` 被認成二維陣列存取——拿 `5` 當**列索引**去一個只有一列的
     * 東西上取，`INDEX_OUT_OF_RANGE`。
     *
     * > **兩個語法形狀相同的東西，差別在【那個容器是什麼】
     * > ——而一個只看語法的判別式看不見它。**
     *
     * 🟢 判準是**它被宣告成什麼**：只有真的二維陣列（`cpp:array_2d_declare`
     * 記下的 `array_2d`）才是我。其餘讓它**自然巢狀**——`x[a]` 先由它自己
     * 那一族認（對照表走鍵、列表走位置、文字走字元），外面再包一層下標。
     *
     * ⚠️ **查不到型別時照舊認領**：那是舊行為，而它對真正的二維陣列是對的
     * ——判不出來時沿用既有的，不要換一個。
     */
    const baseName = innerArrayNode?.text ?? ''
    const baseType = baseName ? ctx.data.getType(baseName) : null
    if (baseType !== null && baseType !== 'array_2d') return null
    const rowIndices = arrayNode.namedChildren.find((c) => c.type === 'subscript_argument_list')
    const rowNode = rowIndices?.namedChildren[0] ?? arrayNode.namedChildren[1]
    const colIndices = node.namedChildren.find((c) => c.type === 'subscript_argument_list')
    const colNode = colIndices?.namedChildren[0] ?? node.namedChildren[1]
    const row = rowNode ? ctx.lift(rowNode) : null
    const col = colNode ? ctx.lift(colNode) : null
    // 🟢 **容器一律 lift**（2026-08-26）——見 `component.json` 的說明。
    const container = innerArrayNode ? ctx.lift(innerArrayNode) : null
    return createNode('cpp:array_2d_at', {}, {
      obj: container ? [container] : [],
      row: row ? [row] : [],
      col: col ? [col] : [],
    })
  })
}
