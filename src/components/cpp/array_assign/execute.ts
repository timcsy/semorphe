/** `cpp:array_assign` 的 **execute** 路——從共用檔原封剪過來（批次第三十七批）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { receiverOf } from '../../../interpreter/receiver'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import { evalInitializer } from '../../../interpreter/aggregate'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:array_assign', async (node, ctx) => {
      const name = String(node.properties.obj)
      const indexNodes = node.slots.index
      const valueNodes = node.slots.value
      if (!indexNodes || indexNodes.length === 0 || !valueNodes || valueNodes.length === 0) return

      const indexVal = await ctx.evaluate(indexNodes[0])
      const index = ctx.toNumber(indexVal)
      const container = receiverOf(ctx.scope, name)
      /**
       * 🔴 **大括號要照那一格的型別填**（2026-09-16）。
       *
       * `pair<int,int> A[10]; A[0] = {3, 1};` 在此之前直接 `evaluate`，
       * 拿到一個**陣列**塞進那一格——於是 `A[0].first` 拋「不是一個結構」。
       *
       * ⚠️ `evalInitializer` 對不是大括號的節點就是原本那條
       * `coerceType(evaluate(…))`，所以這不是行為變更。
       */
      const val = await evalInitializer(valueNodes[0], /**
       * 🔴 **不知道元素型別就【不要假裝知道】**（2026-09-16，模糊測試抓到的）。
       *
       * 這裡曾經寫 `?? 'int'`，於是 `deque<string> d; d.push_back("ab");`
       * 的元素被 `coerceType(…, 'int')` **壓成 0**——程式跑完、印出東西、而它是錯的。
       * （`deque` 至今沒有被登錄成容器樣板，所以它的 `elemType` 是空的。）
       *
       * > **一個「不知道就用預設值」的回退，在預設值剛好是別的型別時
       * > 不會報錯——它會安靜地把資料換掉。**
       *
       * 🟢 空字串會走 `coerceType` 的 default，原樣回傳——**知道才壓，不知道就不動**。
       */
      String(container.elemType ?? ''), ctx)

      // String subscript assign: s[i] = 'x'
      if (container.type === 'string' && typeof container.value === 'string') {
        if (index < 0 || index >= container.value.length) {
          throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(index) })
        }
        const ch = typeof val.value === 'string' ? val.value[0] ?? '' : String.fromCharCode(ctx.toNumber(val))
        const chars = container.value.split('')
        chars[index] = ch
        ctx.scope.set(name, { type: 'string', value: chars.join('') })
        return val
      }

      if (container.type !== 'array' || !Array.isArray(container.value)) {
        throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': 'array' })
      }
      if (index < 0 || index >= container.value.length) {
        throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(index) })
      }
      container.value[index] = val
      /**
       * **指派是一個運算式，它求值成被指派的值。**
       *
       * 🔴 同族的 `cpp:var_assign` 2026-08 就記過這一句，而**這一顆沒跟上**
       *（2026-09-18，語料抓到）。語料上的形狀是併查集：
       * `return (p[x] < 0 ? x : p[x] = find(p[x]));`——那個回傳值**就是**
       * 被指派的那一格，而我們回 `undefined`，印出來是 `void`。
       *
       * > **一個「同一句話要在兩顆元件上各說一次」的規則，
       * > 第二顆會在第一顆修好之後很久才被發現。**
       */
      return val
    })
}
