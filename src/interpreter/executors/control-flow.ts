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
  register('if', async (node, ctx) => {
    const condition = await ctx.evaluate(node.children.condition[0])
    if (ctx.toBool(condition)) {
      await ctx.executeBody(node.children.then_body ?? [])
    } else {
      await ctx.executeBody(node.children.else_body ?? [])
    }
  })

  register('count_loop', async (node, ctx) => {
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
        ctx.scope = parentScope
        throw signal
      }
    }
    ctx.scope = parentScope
  })

  register('while_loop', async (node, ctx) => {
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
        ctx.scope = parentScope
        throw signal
      }
    }
    ctx.scope = parentScope
  })

  register('break', async () => { throw new BreakSignal() })

  register('continue', async () => { throw new ContinueSignal() })
}
