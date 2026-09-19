/**
 * `cpp:pointer_step` 的 **execute** 路——**一行**。
 *
 * 迭代器在這個直譯器裡是**實體式指標**（`interpreter/pointer.ts` 的檔頭：
 * 「迭代器 ＝ 實體式指標」），所以「相鄰的一格」就是位移 ±1。
 *
 * 🔴 **三個邊界全部由 `movePointer` 處理，不要在這裡重做一次：**
 *
 * ```
 * 反向的位置      它自己翻轉 delta（那個函式逐字：「反向的位置，『下一個』是往前」）
 * 走出容器        它刻意不檢查（「只有解參考才是錯的，而 pointer_deref 已經在檢查了」）
 * 字串的位置      它是 { ...v, … }，readonlyCells 與 reverse 都保留
 * 刪除補償        它重新蓋 era 章——【手寫 { offset } 會漏掉】
 * ```
 *
 * > **一個已經處理過四件事的函式，繞過它去自己組一個物件，
 * > 會漏掉的正是那四件裡最不顯眼的一件。**
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { isCellPointer, movePointer } from '../../../interpreter/pointer'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:pointer_step', async (node, ctx) => {
    const posNode = (node.slots.pos ?? [])[0]
    if (!posNode) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': '這個「相鄰的位置」沒有接上任何位置' })
    }
    const pos = await ctx.evaluate(posNode)
    if (!isCellPointer(pos)) {
      /**
       * ⚠️ **訊息要說得出是誰**——2026-09-19 才因為三句說不出「誰」的訊息花掉一輪。
       */
      const dir = String(node.properties.direction ?? 'prev')
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, {
        '%1': `${dir}(…) 要的是一個位置，而接到的是 ${pos.type}`
          + `（${posNode.componentId}）——位置來自容器的開頭／結尾那一族`,
      })
    }
    /**
     * 🔴 **「幾格」留空時是一格**——那是 C++ 的預設引數 `n = 1`，不是我們發明的。
     * ⚠️ 負數也是合法的（`prev(it, -2)` ＝ 往後兩格），所以**不要取絕對值**
     *   ——`movePointer` 收得下任何整數，方向的翻轉也由它處理。
     */
    const countNode = (node.slots.count ?? [])[0]
    const steps = countNode ? ctx.toNumber(await ctx.evaluate(countNode)) : 1
    const sign = String(node.properties.direction ?? 'prev') === 'prev' ? -1 : 1
    return movePointer(pos, sign * steps)
  })
}
