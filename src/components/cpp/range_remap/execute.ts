/**
 * `cpp:range_remap` 的 **execute** 路——與 Arduino 的 `map()` **逐字相同的算法**。
 *
 * ```c
 * (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min
 * ```
 *
 * 🔴 **它是整數運算，所以會捨去**——而那正是初學者最常被咬的地方
 * （`map(511, 0, 1023, 0, 255)` 是 127 不是 127.5）。
 * ⚠️ **不要「順手」改成浮點**：那會讓這個積木與真板子算出不同的數。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:range_remap', async (node, ctx) => {
    const at = async (slot: string): Promise<number> =>
      ctx.toNumber(await ctx.evaluate((node.children[slot] ?? [])[0]))
    const [x, inMin, inMax, outMin, outMax] =
      [await at('value'), await at('from_low'), await at('from_high'), await at('to_low'), await at('to_high')]
    // ⚠️ 來源區間為零寬時真板子會除以零；這裡丟錯而不是回一個看起來合理的數
    if (inMax === inMin) throw new Error(`map() 的來源區間上下限相同（${inMin}）——除以零`)
    return { type: 'int', value: Math.trunc((x - inMin) * (outMax - outMin) / (inMax - inMin)) + outMin }
  })
}
