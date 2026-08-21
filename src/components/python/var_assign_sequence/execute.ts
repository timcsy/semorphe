/**
 * `python:var_assign_sequence` 的 **execute** 路——把右邊拆開分給每個名字。
 *
 * 🔴 **格數對不上就丟錯**：Python 說 `ValueError: not enough values to unpack`。
 * 補 None 或忽略多的，會讓一個真的錯誤看起來像跑成功了。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:var_assign_sequence', async (node, ctx) => {
    const names = (node.children.targets ?? []).map((t) => String(t.properties.name ?? ''))
    const v = await ctx.evaluate(node.children.value[0])
    const parts = v.type === 'array' ? (v.value as RuntimeValue[])
      : v.type === 'string' ? [...String(v.value)].map((c) => ({ type: 'string' as const, value: c }))
      : null
    if (!parts || parts.length !== names.length) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, {
        '%1': `要拆成 ${names.length} 格，而右邊有 ${parts ? parts.length : '不是一組值'}`,
      })
    }
    names.forEach((n, i) => {
      if (ctx.scope.has(n)) ctx.scope.set(n, parts[i])
      else ctx.scope.declare(n, parts[i])
    })
  })
}
