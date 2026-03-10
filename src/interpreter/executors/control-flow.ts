import type { ConceptExecutor } from '../executor-registry'
import type { RuntimeValue } from '../types'
import { Scope } from '../scope'

/** Break/Continue signals (non-error, used for flow control) */
export class BreakSignal { readonly _brand = 'break' }
export class ContinueSignal { readonly _brand = 'continue' }

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

  register('cpp_for_loop', async (node, ctx) => {
    const body = node.children.body ?? []
    const parentScope = ctx.scope
    const forScope = parentScope.createChild()
    ctx.scope = forScope

    if (node.children.init && node.children.init.length > 0) {
      await ctx.executeNode(node.children.init[0])
    }

    while (true) {
      if (node.children.cond && node.children.cond.length > 0) {
        const condition = await ctx.evaluate(node.children.cond[0])
        if (!ctx.toBool(condition)) break
      }

      ctx.scope = forScope.createChild()
      try {
        await ctx.executeBody(body)
      } catch (signal) {
        if (signal instanceof BreakSignal) { ctx.scope = forScope; break }
        if (signal instanceof ContinueSignal) {
          // fall through to update
        } else {
          ctx.scope = parentScope
          throw signal
        }
      }
      ctx.scope = forScope

      if (node.children.update && node.children.update.length > 0) {
        await ctx.executeNode(node.children.update[0])
      }
    }
    ctx.scope = parentScope
  })

  register('cpp_do_while', async (node, ctx) => {
    const body = node.children.body ?? []
    const condNodes = node.children.cond ?? []
    const parentScope = ctx.scope
    do {
      ctx.scope = parentScope.createChild()
      try {
        await ctx.executeBody(body)
      } catch (signal) {
        if (signal instanceof BreakSignal) { ctx.scope = parentScope; return }
        if (signal instanceof ContinueSignal) { /* fall through to condition check */ }
        else { ctx.scope = parentScope; throw signal }
      }
      if (condNodes.length === 0) break
    } while (ctx.toBool(await ctx.evaluate(condNodes[0])))
    ctx.scope = parentScope
  })

  register('cpp_switch', async (node, ctx) => {
    const exprNodes = node.children.expr ?? []
    if (exprNodes.length === 0) return
    const switchVal = await ctx.evaluate(exprNodes[0])

    const cases = node.children.cases ?? []
    let matched = false

    for (const caseNode of cases) {
      if (!matched) {
        const isDefault = caseNode.concept === 'cpp_default'
        if (!isDefault) {
          const caseValNodes = caseNode.children.value ?? []
          if (caseValNodes.length > 0) {
            const caseVal = await ctx.evaluate(caseValNodes[0])
            if (ctx.toNumber(switchVal) !== ctx.toNumber(caseVal)) continue
          }
        }
        matched = true
      }

      const caseBody = caseNode.children.body ?? []
      try {
        await ctx.executeBody(caseBody)
      } catch (signal) {
        if (signal instanceof BreakSignal) return
        throw signal
      }
    }
  })

  register('break', async () => { throw new BreakSignal() })
  register('continue', async () => { throw new ContinueSignal() })
}
