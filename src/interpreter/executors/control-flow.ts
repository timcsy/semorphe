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
  register('cpp:if', async (node, ctx) => {
    const condition = await ctx.evaluate(node.children.condition[0])
    if (ctx.toBool(condition)) {
      await ctx.executeBody(node.children.then_body ?? [])
    } else {
      await ctx.executeBody(node.children.else_body ?? [])
    }
  })










}
