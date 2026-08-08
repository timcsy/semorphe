import type { ConceptExecutor } from '../executor-registry'

/** Break/Continue signals (non-error, used for flow control) */
export class BreakSignal { readonly _brand = 'break' }
export class ContinueSignal { readonly _brand = 'continue' }
export class ThrownSignal {
  readonly _brand = 'thrown'
  readonly value: unknown
  constructor(value: unknown) { this.value = value }
}

export function registerControlFlowExecutors(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('lang:if', async (node, ctx) => {
    const condition = await ctx.evaluate(node.children.condition[0])
    if (ctx.toBool(condition)) {
      await ctx.executeBody(node.children.then_body ?? [])
    } else {
      await ctx.executeBody(node.children.else_body ?? [])
    }
  })

  /**
   * `if_else` 與 `if` 是**同一件事的兩個概念**，差別只在子節點的名字
   * （`then`／`else` vs `then_body`／`else_body`）。
   *
   * 它長期沒有執行器——有概念定義、有產生器、有積木投影（`u_if_else`，
   * 使用者拖得到），跑起來丟未知概念。完備性護欄的五路裡唯一的一個「缺」
   * 就是它，而我第一次看到時以為那是誤報。**實測它是真的。**
   */
  register('lang:if_else', async (node, ctx) => {
    const condition = await ctx.evaluate(node.children.condition[0])
    await ctx.executeBody(ctx.toBool(condition) ? (node.children.then ?? []) : (node.children.else ?? []))
  })

  register('lang:count_loop', async (node, ctx) => {
    const varName = String(node.properties.var_name)
    const from = ctx.toNumber(await ctx.evaluate(node.children.from[0]))
    const to = ctx.toNumber(await ctx.evaluate(node.children.to[0]))
    const body = node.children.body ?? []
    const parentScope = ctx.scope
    const inclusive = node.properties.inclusive === 'TRUE'

    for (let i = from; inclusive ? i <= to : i < to; i++) {
      ctx.scope = parentScope.createChild()
      ctx.scope.declare(varName, { type: 'int', value: i })
      try {
        await ctx.executeBody(body)
      } catch (signal) {
        if (signal instanceof BreakSignal) break
        if (signal instanceof ContinueSignal) continue
        await ctx.exitScope(ctx.scope, parentScope)
        throw signal
      }
    }
    await ctx.exitScope(ctx.scope, parentScope)
  })

  register('lang:while_loop', async (node, ctx) => {
    const body = node.children.body ?? []
    const parentScope = ctx.scope
    while (true) {
      ctx.scope = parentScope.createChild()
      const condition = await ctx.evaluate(node.children.condition[0])
      if (!ctx.toBool(condition)) break
      try {
        await ctx.executeBody(body)
      } catch (signal) {
        if (signal instanceof BreakSignal) break
        if (signal instanceof ContinueSignal) continue
        await ctx.exitScope(ctx.scope, parentScope)
        throw signal
      }
    }
    await ctx.exitScope(ctx.scope, parentScope)
  })

  register('lang:break', async () => { throw new BreakSignal() })

  register('lang:continue', async () => { throw new ContinueSignal() })
}
