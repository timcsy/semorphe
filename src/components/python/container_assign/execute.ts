/**
 * `python:container_assign` 的 **execute** 路——`a[0] = 5`／`d[k] = v`／`grid[1][1] = 9`。
 *
 * 🔴 **求值的是「容器」那一格，不是整個左邊**：整個左邊求值會**讀出那一格的值**，
 * 而我們要的是那個容器本身。所以這裡拆開 `target` 這顆節點的兩個接點。
 *
 * 🟢 **巢狀因此自然成立**：`grid[1][1]` 的容器是 `grid[1]`，而它是一顆
 * `container_at`——求它的值回傳的是**同一個串列**（值型別用參照語義）。
 *
 * ⚠️ **字典可以用指派新增一個鍵，串列不行**——那是 Python 的規則，
 * 而兩者在這裡是同一個節點型別，所以判別在**執行期看容器是什麼**。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import { dictSet } from '../../../languages/python/dict'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:container_assign', async (node, ctx) => {
    const at = (node.children.target ?? [])[0]
    const inner = at?.children?.target?.[0]
    const keyNode = at?.children?.key?.[0]
    if (!inner || !keyNode) {
      // 認得出來而拆不開＝上游給了一個不是「取那一格」的左邊，**出聲不要猜**
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': '這個左邊不是「容器的某一格」' })
    }
    const container = await ctx.evaluate(inner)
    const key = await ctx.evaluate(keyNode)
    const v = await ctx.evaluate(node.children.value[0])

    if (container.type === 'object') {
      // ⚠️ **同時記住那個鍵原本長什麼樣**——`count[3] = 1` 的 3 是整數，
      //    而底層的 `Map` 只吃字串（見 `languages/python/dict.ts`）。
      dictSet(container, key, v)
      return
    }
    if (container.type === 'array') {
      const xs = container.value as RuntimeValue[]
      let i = Math.trunc(ctx.toNumber(key))
      if (i < 0) i += xs.length
      // 🔴 **串列不能用指派長出新的一格**（Python 是 IndexError）
      if (i < 0 || i >= xs.length) {
        throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(key.value) })
      }
      xs[i] = v
      return
    }
    throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': '這個東西不能用位置存進去' })
  })
}
