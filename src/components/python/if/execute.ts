/** `python:if` 的 **execute** 路——依序試每一個分支。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:if', async (node, ctx) => {
    // ⚠️ Python 的 if 【沒有】自己的作用域——裡面指派的名字外面也看得到。
    if (ctx.toBool(await ctx.evaluate(node.children.condition[0]))) {
      await ctx.executeBody(node.children.body ?? [])
      return
    }
    const conds = node.children.elif_condition ?? []
    const bodies = node.children.elif_body ?? []
    for (let i = 0; i < conds.length; i++) {
      if (ctx.toBool(await ctx.evaluate(conds[i]))) {
        // ⚠️ **一支的主體可以是「一段」**（`_compound`）——不攤開的話
        //    執行器會拿到一個它不認得的身分，而那一支只跑得到第一行。
        const b = bodies[i]
        await ctx.executeBody(
          !b ? [] : b.componentId === '_compound' ? (b.children.body ?? []) : [b],
        )
        return
      }
    }
    await ctx.executeBody(node.children.else_body ?? [])
  })
}
