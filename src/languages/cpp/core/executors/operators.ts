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
  register('cpp:sizeof', async (node, ctx) => {
    const target = String(node.properties.target ?? 'int')
    const sizes: Record<string, number> = {
      'char': 1, 'bool': 1, 'short': 2,
      'int': 4, 'float': 4, 'long': 8,
      'double': 8, 'long long': 8, 'long double': 16,
    }
    if (target in sizes) return { type: 'int', value: sizes[target] }

    // `sizeof(a)` 的目標是一個**變數**時，回它佔的位元組數。
    // 原本一律回預設的 4——於是 `sizeof(a)/sizeof(a[0])` 這個算陣列長度的
    // 慣用寫法**永遠回 1**，而那個 1 看起來像一個合理的數字。
    if (ctx.scope.has(target)) {
      const v = ctx.scope.get(target)
      if (v.type === 'array') {
        const arr = v.value as unknown[]
        const elem = (arr[0] as { type?: string } | undefined)?.type ?? 'int'
        return { type: 'int', value: arr.length * (sizes[elem] ?? 4) }
      }
      return { type: 'int', value: sizes[v.type] ?? 4 }
    }
    return { type: 'int', value: 4 }
  })

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
