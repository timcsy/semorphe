/** `cpp:bits_is` 的 **execute** 路——三個問句。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:bits_is', async (node, ctx) => {
    const objNode = (node.slots.obj ?? [])[0]
    const row = objNode ? await ctx.evaluate(objNode) : null
    if (!row || row.type !== 'array' || !Array.isArray(row.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, {
        '%1': `這個接收者不是一排位元（它是 ${row ? row.type : '空的'}）`
          + '——「有沒有 1／是不是全 0／是不是全 1」要的是一排位元',
      })
    }
    const cells = row.value as { value: unknown }[]
    const ones = cells.reduce((n, c) => n + (Number(c.value) ? 1 : 0), 0)
    const m = String(node.properties.method ?? 'any')
    /** ⚠️ 空的一排：`any` 是 false、`none` 與 `all` 都是 **true**（C++ 定死的）。 */
    const v = m === 'any' ? ones > 0 : m === 'none' ? ones === 0 : ones === cells.length
    return { type: 'bool' as const, value: v }
  })
}
