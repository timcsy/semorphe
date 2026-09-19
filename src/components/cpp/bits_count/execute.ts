/** `cpp:bits_count` 的 **execute** 路——整數與一排位元都數得出來。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:bits_count', async (node, ctx) => {
    const value = node.slots.obj?.[0]
    if (!value) return { type: 'int' as const, value: 0 }
    const v = await ctx.evaluate(value)
    /**
     * 🔴 **一排位元就直接數格子**（2026-09-19）——不要把它轉成一個整數再數：
     * 語料的 `bitset<200007>` 塞不進任何一個整數型別。
     * ⚠️ 判準問**它是不是一排格子**，不問 `form` 屬性——屬性說的是「怎麼寫」，
     *    而這裡要知道的是「手上這個東西是什麼」。
     */
    if (v.type === 'array' && Array.isArray(v.value)) {
      let n = 0
      for (const c of v.value as { value: unknown }[]) if (Number(c.value)) n++
      return { type: 'int' as const, value: n }
    }
    // ⚠️ **`>>> 0` 而不是 `>>`**：`__builtin_popcount` 吃的是 `unsigned int`，
    // 而 JS 的 `>>` 是帶號位移——`__builtin_popcount(-1)` 該是 32，
    // 帶號位移會讓迴圈永遠不結束（`-1 >> 1` 還是 `-1`）。
    let n = ctx.toNumber(v) >>> 0
    let count = 0
    while (n !== 0) {
      count += n & 1
      n >>>= 1
    }
    return { type: 'int' as const, value: count }
  })
}
