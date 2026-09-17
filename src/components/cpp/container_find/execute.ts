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
import { varRefName } from '../var_ref/lift'
import { evalInitializer } from '../../../interpreter/aggregate'
import type { RuntimeValue } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import { compareValues, pairParts } from '../../../languages/cpp/lang/runtime/map'

/**
 * 一格拿來比大小的東西。
 *
 * 🔴 **判準是「這個容器是不是對照表」，不是「這一格看起來像不像一對」**（2026-09-17）。
 *
 * 第一版寫 `pairParts(cell)?.key ?? cell`——對對照表是對的，而 `multiset<pair<int,int>>`
 * 的每一格**本身就是一對**，於是它被拆開只比了第一個。症狀：
 * `st.lower_bound({2, 0})` 在 `{1,9}`／`{5,0}` 上回傳第 0 格（應該是第 1 格）。
 *
 * > **一個「看起來像什麼就當成什麼」的判準，
 * > 會在「裝的東西剛好長那樣」的容器上答錯——而那正是語料在寫的東西。**
 */
function keyOf(cell: RuntimeValue, keyed: boolean): RuntimeValue {
  return keyed ? (pairParts(cell)?.key ?? cell) : cell
}

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:container_find', async (node, ctx) => {
    // 🔴 **接收者求值，不再解析一串文字**（2026-09-18）——見 `component.json` 的 `_slots_why`
    /**
     * ⚠️ **錯誤訊息要說得出是誰**——接收者變成接點之後，這裡不再有名字。
     * 🔴 而這一格差點靜默：`name` **是 DOM 的全域**，所以刪掉區域宣告之後
     * `${name}` 仍然編得過，只是在執行時變成 `undefined`。
     * > **一個被刪掉的區域變數，如果它的名字剛好是全域的，型別檢查不會報。**
     */
    const name = varRefName((node.slots.obj ?? [])[0]) ?? '這個接收者'
    const how = String(node.properties.how ?? 'find')
    const keyNodes = node.slots.key ?? []
    if (keyNodes.length === 0) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': `「${name}」的查找少了要找的東西` })
    }
    // ⚠️ **接收者先解析**：要找的那個東西可能是一個大括號（`st.lower_bound({2, 0})`），
    //    而它該變成什麼，只有容器知道。與插入那一顆走同一條路。
    const c = await ctx.evaluate((node.slots.obj ?? [])[0])
    if (c.type !== 'array' || !Array.isArray(c.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': `${name} 不是容器` })
    }
    const want = await evalInitializer(keyNodes[0], String(c.elemType ?? ''), ctx)
    const cells = c.value as RuntimeValue[]
    // ⚠️ 容器是**有序的**（插入時就排好了），所以線性掃出來的第一個就是答案。
    //    這裡刻意不用二分搜：正確性與可讀性優先，而語料的容器都不大。
    const hit = cells.findIndex((cell) => {
      const d = compareValues(keyOf(cell, c.keyed === true), want)
      return how === 'upper_bound' ? d > 0 : how === 'lower_bound' ? d >= 0 : d === 0
    })
    // 🔴 **找不到 ＝ 結尾之後**，而那是一個合法的位置（只有解參考它才是錯的）。
    return { type: 'array', value: cells, offset: hit === -1 ? cells.length : hit }
  })
}
