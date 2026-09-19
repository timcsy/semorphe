/**
 * `cpp:bits_as` 的 **execute** 路——把一排位元換成一個整數或一串 0／1。
 *
 * ⚠️ **第 0 格是最低位**（C++ 定死的），而 `to_string` 的**第一個字元是最高位**
 * ——兩個方向相反，搞反的症狀是答案對稱地錯而不出聲。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import { narrow } from '../../../interpreter/int64'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:bits_as', async (node, ctx) => {
    const objNode = (node.slots.obj ?? [])[0]
    const row = objNode ? await ctx.evaluate(objNode) : null
    if (!row || row.type !== 'array' || !Array.isArray(row.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, {
        '%1': `這個接收者不是一排位元（它是 ${row ? row.type : '空的'}）——「換成整數／字串」要的是一排位元`,
      })
    }
    const cells = row.value as { value: unknown }[]
    const m = String(node.properties.method ?? 'to_ulong')
    if (m === 'to_string') {
      let s = ''
      for (let i = cells.length - 1; i >= 0; i--) s += Number(cells[i].value) ? '1' : '0'
      return { type: 'string' as const, value: s }
    }
    /**
     * 🔴 **用 bigint 疊**——`bitset<96>` 的低 64 位塞不進 JavaScript 的 number。
     * ⚠️ 而 C++ 在**值放不下**時會丟 `overflow_error`；這裡的處置是**照算**
     *    （`narrow` 會在超過 2^53 時保持精確），而不是發明一個截斷的答案。
     */
    let v = 0n
    for (let i = cells.length - 1; i >= 0; i--) v = (v << 1n) | (Number(cells[i].value) ? 1n : 0n)
    return { type: 'int' as const, value: narrow(v) }
  })
}
