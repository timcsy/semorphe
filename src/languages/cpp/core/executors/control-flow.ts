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






}
