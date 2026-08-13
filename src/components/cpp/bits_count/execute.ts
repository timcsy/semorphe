/** `cpp:bits_count` 的 **execute** 路 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:bits_count', async (node, ctx) => {
    const value = node.children.value?.[0]
    if (!value) return { type: 'int' as const, value: 0 }
    // ⚠️ **`>>> 0` 而不是 `>>`**：`__builtin_popcount` 吃的是 `unsigned int`，
    // 而 JS 的 `>>` 是帶號位移——`__builtin_popcount(-1)` 該是 32，
    // 帶號位移會讓迴圈永遠不結束（`-1 >> 1` 還是 `-1`）。
    let n = ctx.toNumber(await ctx.evaluate(value)) >>> 0
    let count = 0
    while (n !== 0) {
      count += n & 1
      n >>>= 1
    }
    return { type: 'int' as const, value: count }
  })
}
