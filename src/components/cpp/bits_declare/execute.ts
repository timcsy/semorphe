/**
 * `cpp:bits_declare` 的 **execute** 路——**一排只裝 0／1 的格子**。
 *
 * ## 🔴 為什麼是 `type: 'array'` 而不是一個新的執行期型別
 *
 * 索引（讀與寫）**今天就會**——實測 `d[1][2] = 7`、`int[2][3]`、
 * 以及語料真正的 `d1[i][x[j]-'A'] = 1` 全部是綠的。而它們走的是
 * 同族那顆**取第幾格**的元件，而**它要求 `container.type === 'array'`**。
 *
 * 換一個新的執行期型別，等於把一件免費的事變成要改三個地方的事。
 *
 * > **一個已經能用的機制，繞過它去自己開一種型別，
 * > 會漏掉的正是那個機制順手處理掉的那幾件事。**
 *
 * 🟢 **而「它是一排位元」這件事寫在 `elemType`**：位元運算子靠它分辨
 * 「一排位元」與「一個 `vector<int>`」——`v1 ^ v2` 在 C++ 裡不合法，
 * 而它不該因為兩者在這裡長得像就變成合法。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

/** 一排位元的元素型別章——位元運算子問的就是它。 */
export const BIT_ELEM = 'bit'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:bits_declare', async (node, ctx) => {
    const name = String(node.properties.name ?? 'bs')
    const sizeNodes = node.slots.size ?? []
    if (sizeNodes.length === 0) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, {
        '%1': `一排位元「${name}」沒有說有幾格——bitset<N> 的 N 是它的全部長度`,
      })
    }
    const n = ctx.toNumber(await ctx.evaluate(sizeNodes[0]))
    if (!Number.isFinite(n) || n < 0) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, {
        '%1': `一排位元「${name}」的格數不是一個非負整數：${String(n)}`,
      })
    }
    // ⚠️ 全部從 0 開始——C++ 的 `bitset<N> bs;` 是值初始化，每一位都是 0。
    const cells = Array.from({ length: Math.trunc(n) }, () => ({ type: 'int' as const, value: 0 }))
    /**
     * 🔴 **有初始值就照抄過來**（`bitset<8> b = a >> 2;`）。
     * ⚠️ **複製一份，不共用那個陣列**——`b = a` 之後改 `b[0]` 不得動到 `a`。
     *    C++ 的 bitset 是值語義，而這裡拿到的是另一排的參考。
     * ⚠️ 長度以**宣告的那個**為準：來源比較短時其餘補 0，比較長時多的丟掉。
     */
    const srcNode = (node.slots.source ?? [])[0]
    if (srcNode) {
      const v = await ctx.evaluate(srcNode)
      if (v.type === 'array' && Array.isArray(v.value)) {
        const from = v.value as { value: unknown }[]
        for (let i = 0; i < cells.length; i++) cells[i].value = i < from.length && Number(from[i].value) ? 1 : 0
      } else {
        throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, {
          '%1': `一排位元「${name}」的初始值不是一排位元（它是 ${v.type}）`,
        })
      }
    }
    ctx.scope.declare(name, { type: 'array', value: cells, elemType: BIT_ELEM })
  })
}
