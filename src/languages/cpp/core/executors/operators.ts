/**
 * operators 的語言專屬執行路——5 個。
 *
 * 通用的那些留在核心（拔掉 C++ 之後仍然存在，不是違規）；
 * 這裡是語言專屬的部分。歸屬由概念定義的層級欄位決定，不由檔名。
 *
 * 見 specs/055-finish-executor-move/
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'

export function registerOperatorsCoreExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {




  register('cpp:ternary', async (node, ctx) => {
    const condNodes = node.children.condition ?? []
    const trueNodes = node.children.true_expr ?? []
    const falseNodes = node.children.false_expr ?? []
    if (condNodes.length === 0) return { type: 'int', value: 0 }

    const condition = await ctx.evaluate(condNodes[0])
    if (ctx.toBool(condition)) {
      return trueNodes.length > 0 ? await ctx.evaluate(trueNodes[0]) : { type: 'int', value: 0 }
    } else {
      return falseNodes.length > 0 ? await ctx.evaluate(falseNodes[0]) : { type: 'int', value: 0 }
    }
  })



  register('cpp:comma_expr', async (node, ctx) => {
    const exprs = node.children.exprs ?? []
    let last: import('../../../../interpreter/types').RuntimeValue = { type: 'int', value: 0 }
    for (const expr of exprs) {
      last = (await ctx.executeNode(expr)) as import('../../../../interpreter/types').RuntimeValue ?? last
    }
    return last
  })
}
