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


  register('cpp:bitwise_not', async (node, ctx) => {
    const operand = await ctx.evaluate(node.children.operand[0])
    const val = ctx.toNumber(operand)
    return { type: 'int', value: ~Math.trunc(val) }
  })

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

  register('cpp:cast', async (node, ctx) => {
    const targetType = String(node.properties.target_type ?? 'int')
    const valueNodes = node.children.value ?? []
    if (valueNodes.length === 0) return { type: 'int', value: 0 }
    const val = await ctx.evaluate(valueNodes[0])
    const num = ctx.toNumber(val)
    // `(char)66` 要變成**字元**，不是整數 66——回 int 的話 `cout` 印出 66。
    if (targetType === 'char') {
      return { type: 'char', value: String.fromCharCode(Math.trunc(num)) }
    }
    if (targetType === 'int' || targetType === 'long' || targetType === 'short') {
      return { type: 'int', value: Math.trunc(num) }
    }
    if (targetType === 'double' || targetType === 'float') {
      return { type: 'double', value: num }
    }
    return val
  })

  // C++ named casts behave the same as C-style cast at runtime
  for (const castConcept of ['cpp:cast_static', 'cpp:cast_dynamic', 'cpp:cast_reinterpret', 'cpp:cast_const']) {
    register(castConcept, async (node, ctx) => {
      const targetType = String(node.properties.target_type ?? 'int')
      const valueNodes = node.children.value ?? []
      if (valueNodes.length === 0) return { type: 'int', value: 0 }
      const val = await ctx.evaluate(valueNodes[0])
      const num = ctx.toNumber(val)
      if (targetType === 'int' || targetType === 'long' || targetType === 'short' || targetType === 'char') {
        return { type: 'int', value: Math.trunc(num) }
      }
      if (targetType === 'double' || targetType === 'float') {
        return { type: 'double', value: num }
      }
      return val
    })
  }

  register('cpp:comma_expr', async (node, ctx) => {
    const exprs = node.children.exprs ?? []
    let last: import('../../../../interpreter/types').RuntimeValue = { type: 'int', value: 0 }
    for (const expr of exprs) {
      last = (await ctx.executeNode(expr)) as import('../../../../interpreter/types').RuntimeValue ?? last
    }
    return last
  })
}
