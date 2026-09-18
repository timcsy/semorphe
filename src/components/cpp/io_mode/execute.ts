/**
 * `cpp:io_mode` 的 **execute** 路——**設一格串流狀態，然後印零個字**。
 *
 * ⚠️ 回傳空字串而不是不回傳：輸出那一路對每一項都要求一個值，
 *    而「印出零個字」與「這一項不存在」在那條路上是兩件事。
 *    真正把欄寬用掉的是**下一個真的印出東西的項**（見 `runtime/stream-state.ts`）。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { streamState } from '../../../languages/cpp/lang/runtime/stream-state'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:io_mode', async (node, ctx) => {
    const st = streamState(ctx.io as unknown as object)
    const valNode = (node.slots.value ?? [])[0]
    if (!valNode) {
      // 接不到東西時**出聲**——一個設成「沒有值」的設定會安靜地改掉之後每一行的輸出。
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': '這個輸出設定沒有接上要設成多少' })
    }
    const v = await ctx.evaluate(valNode)
    const setting = String(node.properties.setting ?? 'width')
    if (setting === 'fill') {
      /**
       * ⚠️ **補位的字是一個【字元】**，而 `char` 在這個直譯器裡有兩種表示
       * （碼位與單字元字串，見那顆字元字面值的說明）——兩種都要收得下。
       */
      const c = typeof v.value === 'number' ? String.fromCharCode(v.value) : String(v.value ?? ' ')
      st.fill = c.length > 0 ? c[0] : ' '
    } else if (setting === 'precision') {
      st.precision = Math.max(0, Math.trunc(ctx.toNumber(v)))
    } else {
      st.width = Math.max(0, Math.trunc(ctx.toNumber(v)))
    }
    return { type: 'string' as const, value: '' }
  })
}
