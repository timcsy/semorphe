/** `cpp:container_push` 的 **execute** 路——從共用檔原封剪過來（批次第三十五批）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { evalInitializer } from '../../../interpreter/aggregate'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:container_push', async (node, ctx) => {
      // 🔴 **接收者求值，不再解析一串文字**（2026-09-18）——見 `component.json` 的 `_slots_why`
      const valueNodes = node.slots.value ?? []
      if (valueNodes.length === 0) return
      const arr = await ctx.evaluate((node.slots.obj ?? [])[0])
      if (arr.type !== 'array' || !Array.isArray(arr.value)) {
        throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
      }
      /**
       * 🔴 **元素要照容器裝的東西長**（2026-09-18）——同族的「在尾端加入」
       * 與「在前端加入」兩顆早就這樣做了，而這一顆沒有。
       *
       * 症狀：`queue<pair<int,int>> q; q.push({1,2}); q.front().first`
       * 說「（不是一個結構）」——`{1,2}` 被當成兩個數字放進去。
       *
       * > **同一族的三顆元件，兩顆做了某件事而一顆沒有——
       * > 那個差別不會有人發現，直到有人寫出只有前兩顆能表達的程式。**
       *
       * ⚠️ `?? ''` 不是筆誤：**知道才壓，不知道就不動**（空字串走 `coerceType`
       * 的 default，原樣回傳）。寫 `?? 'int'` 的話字串元素會被壓成 0。
       */
      const val = await evalInitializer(valueNodes[0], String(arr.elemType ?? ''), ctx)
      arr.value.push(val)
    })
}
