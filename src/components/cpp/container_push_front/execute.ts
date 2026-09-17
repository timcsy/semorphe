import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { evalInitializer } from '../../../interpreter/aggregate'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:container_push_front', async (node, ctx) => {
    // 🔴 **接收者求值，不再解析一串文字**（2026-09-18）——見 `component.json` 的 `_slots_why`
    const valueNodes = node.slots.value ?? []
    if (valueNodes.length === 0) return
    /**
     * ⚠️ **接收者要走 `receiverOf`**——`d2[3].push_front(x)` 這種帶下標的接收者
     * 在組裝時被壓成字串 `"d2[3]"`，直接 `scope.get` 會找不到那個名字。
     */
    const arr = await ctx.evaluate((node.slots.obj ?? [])[0])
    if (arr.type !== 'array' || !Array.isArray(arr.value)) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
    }
    /**
     * 🔴 **不知道元素型別就【不要假裝知道】**（`?? ''` 不是筆誤）。
     *
     * 同族那顆「在尾端加入」的元件曾經寫 `?? 'int'`，於是
     * `deque<string> d; d.push_back("ab");` 的元素被壓成 0
     * ——程式跑完、印出東西、而它是錯的。空字串會走 `coerceType` 的 default，
     * 原樣回傳：**知道才壓，不知道就不動**。
     */
    const val = await evalInitializer(valueNodes[0], String(arr.elemType ?? ''), ctx)
    arr.value.unshift(val)
  })
}
