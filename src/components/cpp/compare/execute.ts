/** `cpp:compare` 的 **execute** 路——從共用檔原封剪過來（批次第三十六批：字面值與二元運算子）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:compare', async (node, ctx) => {
      const op = String(node.properties.operator)
      const left = await ctx.evaluate(node.children.left[0])
      const right = await ctx.evaluate(node.children.right[0])

      // ⚠️ **字串要比內容。**
      //
      // 原本一律走 `toNumber`，而 `Number('abc') || 0` 是 0——**兩個字串都變成
      // 0，於是 `==` 恆真、`!=` 恆假**。`if (p == "abc")` 對任何字串都成立，
      // 而程式跑完、印出一個數字、那個數字是錯的。
      //
      // 字元（char）不走這裡：C++ 的 `'a' < 'b'` 比的是碼值，而現有行為已對。
      if (left.type === 'string' || right.type === 'string') {
        const ls = String(left.value)
        const rs = String(right.value)
        let r: boolean
        switch (op) {
          case '<': r = ls < rs; break
          case '>': r = ls > rs; break
          case '<=': r = ls <= rs; break
          case '>=': r = ls >= rs; break
          case '==': r = ls === rs; break
          case '!=': r = ls !== rs; break
          default: r = false
        }
        return { type: 'bool', value: r }
      }

      const lv = ctx.toNumber(left)
      const rv = ctx.toNumber(right)

      let result: boolean
      switch (op) {
        case '<': result = lv < rv; break
        case '>': result = lv > rv; break
        case '<=': result = lv <= rv; break
        case '>=': result = lv >= rv; break
        case '==': result = lv === rv; break
        case '!=': result = lv !== rv; break
        default: result = false
      }
      return { type: 'bool', value: result }
    })
}
