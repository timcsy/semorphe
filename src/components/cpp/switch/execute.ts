/** `cpp:switch` 的 **execute** 路——從共用檔原封剪過來（批次第二十九批：switch 族與原始碼容器）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { BreakSignal } from '../../../interpreter/executors/control-flow'
import { isDefaultCase } from '../../../languages/cpp/core/node-traits'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:switch', async (node, ctx) => {
      const exprNodes = node.children.expr ?? []
      if (exprNodes.length === 0) return
      const switchVal = await ctx.evaluate(exprNodes[0])

      const cases = node.children.cases ?? []
      let matched = false

      for (const caseNode of cases) {
        if (!matched) {
          const isDefault = isDefaultCase(caseNode.componentId)
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
