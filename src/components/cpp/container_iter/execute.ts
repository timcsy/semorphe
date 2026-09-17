/**
 * `cpp:container_iter` 的 **execute** 路
 *
 * 迭代器在這個直譯器裡就是**實體式指標**：一個陣列 ＋ 一個 `offset`
 * ——與 `&arr[i]`／`new int[n]` 完全相同的表示（見 `cpp:address_of`）。
 *
 * > **不為迭代器發明第三種表示。** 指標算術（`it + 1`）、解參考（`*it`）、
 * > 相減（`it - v.begin()`）在那個表示上全都已經能跑。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { varRefName } from '../var_ref/lift'
import type { RuntimeValue } from '../../../interpreter/types'
import { positionIn } from '../../../interpreter/pointer'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:container_iter', async (node, ctx) => {
    // 🔴 **接收者求值，不再解析一串文字**（2026-09-18）——見 `component.json` 的 `_slots_why`
    const which = String(node.properties.which ?? 'begin')
    const v = await ctx.evaluate((node.slots.obj ?? [])[0])
      /**
       * ⚠️ **錯誤訊息要說得出是誰**——接收者變成接點之後，這裡不再有名字。
       * 🔴 而這一格差點靜默：`name` **是 DOM 的全域**，所以刪掉區域宣告之後
       * `${name}` 仍然編得過，只是在執行時變成 `undefined`。
       * > **一個被刪掉的區域變數，如果它的名字剛好是全域的，型別檢查不會報。**
       */
      const name = varRefName((node.slots.obj ?? [])[0]) ?? '這個接收者'
    /**
     * 🔴 **一段文字也走得訪**（2026-09-17）——`for (auto c = t.begin(); c != t.end(); ++c)`。
     *
     * 格子**延遲產生並存回那個值身上**：`begin()` 與 `end()` 必須拿到同一份，
     * 否則比較那一條會說「兩個位置不在同一個容器裡」，而迴圈一次都不跑。
     *
     * ⚠️ 那是一個**唯讀的投影**：透過它寫回去改不到文字本身，所以位置上標一個記號，
     *    由寫入那一路出聲。**沉默地寫進一份沒有人會再讀的複本，是最糟的那一種。**
     */
    if (v.type === 'string' && typeof v.value === 'string') {
      const cells = (v.charCells ??= [...v.value].map((ch) => ({ type: 'char' as const, value: ch.charCodeAt(0) })))
      const at = which === 'end' ? cells.length : which === 'rbegin' ? cells.length - 1 : which === 'rend' ? -1 : 0
      const rev = which === 'rbegin' || which === 'rend'
      return positionIn(cells, at, { readonlyCells: true, ...(rev ? { reverse: true } : {}) })
    }
    if (v.type !== 'array' || !Array.isArray(v.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': `${name} 不是容器` })
    }
    // ⚠️ `end()` 指的是**尾端之後一格**——那是 C++ 的慣例，而且合法：
    // 只有解參考它才是錯的，而那由 `pointer_deref` 檢查。
    //
    // 🔴 **反向那兩端是對稱的**（2026-09-17）：`rbegin()` 是最後一個、
    //    `rend()` 是第一個**之前**一格。同樣只有解參考 `rend()` 才是錯的，
    //    而 `offset: -1` 會被 `pointer_deref` 的範圍檢查擋下來。
    //
    // > **一個「界線」不是一個元素**——正反兩邊各有一個，而它們都合法。
    const n = v.value.length
    const cells = v.value as RuntimeValue[]
    if (which === 'rbegin') return positionIn(cells, n - 1, { reverse: true })
    if (which === 'rend') return positionIn(cells, -1, { reverse: true })
    return positionIn(cells, which === 'end' ? n : 0)
  })
}
