/** `cpp:array_declare` 的 **execute** 路——從共用檔原封剪過來（批次第十八批：四個重複建立點收成一個建構子）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { defaultValue } from '../../../interpreter/types'
import { evalInitializer } from '../../../interpreter/aggregate'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:array_declare', async (node, ctx) => {
      const name = String(node.properties.name)
      const type = String(node.properties.type || 'int')

      const sizeChildren = node.children.size ?? []
      let size: number
      if (sizeChildren.length > 0) {
        const sizeVal = await ctx.evaluate(sizeChildren[0])
        size = ctx.toNumber(sizeVal)
      } else {
        const sizeRaw = node.properties.size
        size = Number(sizeRaw || 0)
        if (isNaN(size) && typeof sizeRaw === 'string') {
          try {
            const sizeVal = ctx.scope.get(sizeRaw)
            size = ctx.toNumber(sizeVal)
          } catch {
            size = 0
          }
        }
      }

      const elements: import('../../../interpreter/types').RuntimeValue[] = []
      for (let i = 0; i < size; i++) {
        elements.push(defaultValue(type))
      }

      // 初始值：`int a[3] = {3,1,2}`
      //
      // 辨識那半在 specs/050 就修好了（初始值進 `children.values`），**執行這半
      // 沒有接上**——於是 `int a[3]={3,1,2}; cout << a[0]` 輸出 0。
      // 半條路修好比沒修更難察覺：語義樹裡看得到值，跑起來卻是零。
      const init = node.children.values ?? []
      // `char s[4] = "ab"` —— 初始值是一個字串字面，要**拆成字元**再填。
      // 不拆的話整個字串會塞進 s[0]，於是 s[1] 是空的、cout << s 也不對。
      if (type.includes('char') && init.length === 1) {
        const v = await ctx.evaluate(init[0])
        if (typeof v.value === 'string' && v.value.length > 1) {
          for (let i = 0; i < v.value.length && i < elements.length; i++) {
            elements[i] = { type: 'char', value: v.value[i] }
          }
          if (v.value.length < elements.length) {
            elements[v.value.length] = { type: 'char', value: '\0' }
          }
          ctx.scope.declare(name, { type: 'array', value: elements })
          return
        }
      }
      for (let i = 0; i < init.length && i < elements.length; i++) {
        // **轉成陣列的元素型別**——C++ 會轉，而不轉的話 `char s[4]={'a','1'}`
        // 的元素會留著字元字面求值出來的數字碼，於是 `cout << s[0]` 印出 97
        // 而不是 `a`，`isdigit(s[0])` 也會因為看到 `'9'` 而回傳真。
        //
        // **程式跑完、印出東西、而它是錯的**——這正是「靜默降級」的形狀。
        //
        // ⚠️ `evalInitializer` 而不是 `evaluate`：元素本身可能是一層 `{…}`
        // （`S arr[2] = {{"a",90},{"b",80}}`、多維陣列的內層），
        // 而 `{…}` 在執行那一路**沒有任何人認得**——直接丟 UNKNOWN_CONCEPT。
        elements[i] = await evalInitializer(init[i], type, ctx)
      }
      // 宣告時沒寫大小（`int a[] = {1,2,3}`）→ 長度由初始值決定
      if (size === 0 && init.length > 0) {
        for (const n of init) elements.push(await evalInitializer(n, type, ctx))
      }

      ctx.scope.declare(name, { type: 'array', value: elements })
    })
}
