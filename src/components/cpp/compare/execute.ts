/** `cpp:compare` 的 **execute** 路——從共用檔原封剪過來（批次第三十六批：字面值與二元運算子）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:compare', async (node, ctx) => {
      const op = String(node.properties.operator)
      const left = await ctx.evaluate(node.children.left[0])

      // **左邊是物件時，問它的型別有沒有多載這個運算子。**
      //
      // 🔴 `cpp:arithmetic` 早就在做這件事，而**這一顆沒有**——於是
      // `a == b` 對兩個物件走下面的 `toNumber`，兩邊都變成 NaN，
      // `NaN === NaN` 是 false，`!=` 是 true：**`operator==` 寫了也沒用**，
      // 而輸出是「not equal 印成 also equal」這種看起來像業務邏輯的錯。
      //
      // ⚠️ 機制本來就齊了（`memberRole: "operator"` ＋ `splitMember` 把它存成
      // 名字是 `operator==` 的方法）——**缺的只是這一顆去問**。
      //
      // > **一個機制的消費者少一個，那個機制就對那條路徑不存在。**
      if (left.type === 'object') {
        const m = ctx.structs.method(left.structName ?? '', `operator${op}`)
        if (m) {
          const r = await ctx.structs.invoke(left, m, [node.children.right[0]])
          if (r !== undefined) return r
        }
        // ⚠️ 與 `cpp:arithmetic` 同樣的處置：落到數值路徑會把物件變成 NaN，
        // 而 NaN 的比較永遠是 false／true，看起來像一個合理的答案。**出聲。**
        const { RuntimeError, RUNTIME_ERRORS } = await import('../../../interpreter/errors')
        throw new RuntimeError(RUNTIME_ERRORS.UNDEFINED_FUNCTION, {
          '%1': `${left.structName ?? '物件'} 沒有多載 operator${op}`,
        })
      }

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
