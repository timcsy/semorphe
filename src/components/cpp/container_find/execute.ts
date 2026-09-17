/**
 * `cpp:container_find` 的 **execute** 路——在一個有序容器裡找出一個**位置**。
 *
 * 位置在這個直譯器裡就是實體式指標（一串格子 ＋ 一個 offset），
 * 所以這三個回傳的東西 `*it`／`it != c.end()`／`it - c.begin()` 全都接得住。
 *
 * ## 🔴 找不到的時候回「結尾之後」，不是丟錯也不是空
 *
 * `if (it != c.end())` 是 C++ 判斷「有沒有找到」的標準寫法。
 * 丟錯或回一個空值的話，**那個寫法整個失去意義**——而學生會以為自己寫錯了。
 *
 * > **一個「找不到」的回答，必須是一個可以拿來比較的東西。**
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { receiverOf } from '../../../interpreter/receiver'
import type { RuntimeValue } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import { pairParts } from '../../../languages/cpp/lang/runtime/map'

/** 一格拿來比大小的東西——對照表比它的鍵，集合比值本身。 */
function keyOf(cell: RuntimeValue): RuntimeValue {
  return pairParts(cell)?.key ?? cell
}

/** 兩個值的先後——數字比數值，其餘比字面。與插入時排序用的是同一條規則。 */
function cmp(a: RuntimeValue, b: RuntimeValue): number {
  if (typeof a.value === 'number' && typeof b.value === 'number') return a.value - b.value
  return String(a.value).localeCompare(String(b.value))
}

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:container_find', async (node, ctx) => {
    const name = String(node.properties.obj)
    const how = String(node.properties.how ?? 'find')
    const keyNodes = node.slots.key ?? []
    if (keyNodes.length === 0) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': `「${name}」的查找少了要找的東西` })
    }
    const want = await ctx.evaluate(keyNodes[0])
    const c = receiverOf(ctx.scope, name)
    if (c.type !== 'array' || !Array.isArray(c.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': `${name} 不是容器` })
    }
    const cells = c.value as RuntimeValue[]
    // ⚠️ 容器是**有序的**（插入時就排好了），所以線性掃出來的第一個就是答案。
    //    這裡刻意不用二分搜：正確性與可讀性優先，而語料的容器都不大。
    const hit = cells.findIndex((cell) => {
      const d = cmp(keyOf(cell), want)
      return how === 'upper_bound' ? d > 0 : how === 'lower_bound' ? d >= 0 : d === 0
    })
    // 🔴 **找不到 ＝ 結尾之後**，而那是一個合法的位置（只有解參考它才是錯的）。
    return { type: 'array', value: cells, offset: hit === -1 ? cells.length : hit }
  })
}
