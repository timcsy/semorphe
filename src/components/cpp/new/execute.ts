/**
 * `cpp:new` 的 **execute** 路——**配置真的儲存體**
 *
 * ## 🔴 它原本回傳一個固定字串
 *
 * ```ts
 * return { type: 'pointer', value: `heap_${type}` }   // 舊的
 * ```
 *
 * 兩次 `new int` 拿到**同一個字串**，於是它們指向同一個地方：
 *
 * ```cpp
 * int* a = new int;  int* b = new int;
 * *a = 15;  *b = 25;
 * cout << *a + *b;   // 直譯器 50、真編譯器 40
 * ```
 *
 * 那是第三十二條護欄 14 筆**誤差**裡的第 1 筆——⚠️ 而誤差比缺口嚴重：
 * **系統沒有說「我不會」，它給了一個錯的答案。**
 *
 * ## 一塊連續的儲存體，在這個直譯器裡就是 `array`
 *
 * 所以不必發明堆與位址：`new T` 配一個長度 1 的陣列、`new T[n]` 配長度 n 的。
 * 每次呼叫**都是新的陣列實例**，兩個 `new` 自然就不會撞。
 *
 * 而 `a[i]`（`array_at`）與 `*a`（`pointer_deref`）都認得陣列，
 * **兩條既有的路直接就通**——與 `pair` 那次用 `object` 的理由相同。
 *
 * ⚠️ **這不是一個完整的指標模型**：指標算術（`p = p + 2`）與
 * 「指向某個變數」（`&x`）仍然走 `pointerTargets` 那套符號式的路。
 * 這一刀只讓「動態配置的一塊記憶體」有真的身分。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { defaultValue } from '../../../interpreter/types'
import type { RuntimeValue } from '../../../interpreter/types'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:new', async (node, ctx) => {
    const type = String(node.properties.type ?? 'int')

    // `new int[n]` —— 大小是一個運算式，要求值。
    // ⚠️ 這個接點在 2026-08-13 之前不存在（lift 把 `[n]` 整個丟掉），
    // 所以 `new int[5]` 與 `new int` 在語義樹上是同一棵。
    const sizeNode = (node.children.size ?? [])[0]
    let count = 1
    if (sizeNode) {
      const v = await ctx.evaluate(sizeNode)
      const n = Number(v.value)
      // 負數或非數字 → **出聲**。靜默當成 1 的話，`new int[-1]` 會產出
      // 一個長度 1 的陣列，而後面每一次索引都「剛好」越界報別的錯。
      if (!Number.isFinite(n) || n < 0) {
        const { RuntimeError, RUNTIME_ERRORS } = await import('../../../interpreter/errors')
        throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': `new ${type}[…] 的大小不是非負整數` })
      }
      count = Math.trunc(n)
    }

    const cells: RuntimeValue[] = []
    for (let i = 0; i < count; i++) cells.push(defaultValue(type))
    return { type: 'array', value: cells }
  })
}
