/**
 * control-flow 的語言專屬執行路——6 個。
 *
 * 通用的那些留在核心（拔掉 C++ 之後仍然存在，不是違規）；
 * 這裡是語言專屬的部分。歸屬由概念定義的層級欄位決定，不由檔名。
 *
 * 見 specs/055-finish-executor-move/
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'
// 訊號類別必須是**同一個**——複製一份的話 instanceof 會失敗，
// 而失敗的樣子是「break 逃出迴圈」，不是編譯錯誤。
import { BreakSignal, ContinueSignal } from '../../../../interpreter/executors/control-flow'

/** Break/Continue signals (non-error, used for flow control) */
export class ThrownSignal {
  readonly _brand = 'thrown'
  readonly value: unknown
  constructor(value: unknown) { this.value = value }
}

export function registerControlFlowCoreExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {
  register('cpp:loop_for', async (node, ctx) => {
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



  register('cpp:switch', async (node, ctx) => {
    const exprNodes = node.children.expr ?? []
    if (exprNodes.length === 0) return
    const switchVal = await ctx.evaluate(exprNodes[0])

    const cases = node.children.cases ?? []
    let matched = false

    for (const caseNode of cases) {
      if (!matched) {
        const isDefault = caseNode.conceptId === 'cpp:default'
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

  register('cpp:loop_range', async (node, ctx) => {
    const varName = String(node.properties.var_name ?? 'x')
    const containerName = String(node.properties.container ?? 'vec')
    const body = node.children.body ?? []
    const parentScope = ctx.scope
    const container = ctx.scope.get(containerName)

    if (container.type === 'array' && Array.isArray(container.value)) {
      for (const elem of container.value) {
        ctx.scope = parentScope.createChild()
        ctx.scope.declare(varName, elem)
        try {
          await ctx.executeBody(body)
        } catch (signal) {
          if (signal instanceof BreakSignal) break
          if (signal instanceof ContinueSignal) continue
          ctx.scope = parentScope
          throw signal
        }
      }
    }
    ctx.scope = parentScope
  })

  register('cpp:try_catch', async (node, ctx) => {
    const tryBody = node.children.try_body ?? []
    const catchBody = node.children.catch_body ?? []
    const catchName = String(node.properties.catch_name ?? 'e')
    try {
      await ctx.executeBody(tryBody)
    } catch (signal) {
      if (signal instanceof BreakSignal || signal instanceof ContinueSignal) throw signal
      if (signal instanceof ThrownSignal) {
        const parentScope = ctx.scope
        ctx.scope = parentScope.createChild()
        // ⚠️ **不能 `String(signal.value)`。** `signal.value` 是 RuntimeValue
        // 物件，字串化之後 `catch (int e) { cout << e; }` 印出 `[object Object]`
        // ——程式跑完、印出東西、而那是一個不存在的值。
        const 丟出的 = signal.value as unknown
        const 值 =
          丟出的 !== null && typeof 丟出的 === 'object' && 'type' in (丟出的 as object)
            ? (丟出的 as { type: string; value: unknown })
            : { type: 'string', value: String(丟出的) }
        ctx.scope.declare(catchName, 值 as never)
        await ctx.executeBody(catchBody)
        ctx.scope = parentScope
      } else {
        throw signal
      }
    }
  })


}
