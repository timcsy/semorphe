/** `cpp:compare` 的 **execute** 路——從共用檔原封剪過來（批次第三十六批：字面值與二元運算子）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { isCellPointer, offsetOf, sameCells } from '../../../interpreter/pointer'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import { big } from '../../../interpreter/int64'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:compare', async (node, ctx) => {
      const op = String(node.properties.operator)
      const left = await ctx.evaluate(node.slots.left[0])

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
          const r = await ctx.structs.invoke(left, m, [node.slots.right[0]])
          if (r !== undefined) return r
        }
        // ⚠️ 與 `cpp:arithmetic` 同樣的處置：落到數值路徑會把物件變成 NaN，
        // 而 NaN 的比較永遠是 false／true，看起來像一個合理的答案。**出聲。**
        const { RuntimeError, RUNTIME_ERRORS } = await import('../../../interpreter/errors')
        throw new RuntimeError(RUNTIME_ERRORS.UNDEFINED_FUNCTION, {
          '%1': `${left.structName ?? '物件'} 沒有多載 operator${op}`,
        })
      }

      const right = await ctx.evaluate(node.slots.right[0])

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

      /**
       * 🔴 **兩個【位置】要比「同一串格子嗎、第幾格」**（2026-09-17）。
       *
       * 走下面那條數值路徑的話，`toNumber(一串格子)` 回 **1**（刻意的，
       * 見 `interpreter.ts`：少了它 `while (p != NULL)` 對剛配好的節點是假），
       * 於是**兩個指標都變成 1**：
       *
       * ```
       * int* p = a;  int* e = a + 3;    p != e  →  0（說相等）／ g++ 1
       * int* p = a;  int* q = b;        p != q  →  0（說相等）／ g++ 1
       * ```
       *
       * 後果不是「比較答錯一次」，是**每一個 `while (it != c.end())` 迴圈
       * 一次都不跑**，而程式照樣跑完、印出後面的東西。
       *
       * 🔴 **這與上面那段字串的註解是同一件事，只是晚了一個型別**：
       * 「兩個字串都變成 0，於是 `==` 恆真、`!=` 恆假」。
       * **`toNumber` 壓平了幾種型別，就有幾個這樣的缺陷等著。**
       *
       * ⚠️ **只在兩邊都是位置時才走這裡**：`p != NULL`／`p != 0` 要照舊走
       * 數值路徑，那正是 `toNumber` 回 1 要服務的東西。
       */
      if (isCellPointer(left) && isCellPointer(right)) {
        const same = sameCells(left, right)
        const lo = offsetOf(left)
        const ro = offsetOf(right)
        if (op === '==') return { type: 'bool', value: same && lo === ro }
        if (op === '!=') return { type: 'bool', value: !same || lo !== ro }
        // ⚠️ **不同容器之間比大小，C++ 沒有定義**——不要替它發明一個答案。
        //    出聲而不是猜：一個猜出來的順序會讓二分搜「看起來動了」。
        if (!same) {
          throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, {
            '%1': '兩個位置不在同一個容器裡，比大小沒有意義',
          })
        }
        const r = op === '<' ? lo < ro : op === '>' ? lo > ro : op === '<=' ? lo <= ro : lo >= ro
        return { type: 'bool', value: r }
      }

      /**
       * 🔴 **任一邊是 `bigint` 就用 `bigint` 比**（2026-09-19）。
       *
       * `toNumber` 把 `bigint` 轉成 `number` 是**刻意失真**的（見那一支的註解），
       * 而比較是**唯一一個失真會改變答案**的地方：
       * `9007199254740993 == 9007199254740992` 轉成 number 之後**變成真**。
       *
       * > **`toNumber` 壓平了幾種型別，就有幾個這樣的缺陷等著**
       * > ——這一段上面那兩條註解（字串、位置）講的是同一件事，而這是第三種。
       */
      if (typeof left.value === 'bigint' || typeof right.value === 'bigint') {
        const a = big(typeof left.value === 'bigint' ? left.value : ctx.toNumber(left))
        const b = big(typeof right.value === 'bigint' ? right.value : ctx.toNumber(right))
        const r = op === '<' ? a < b : op === '>' ? a > b : op === '<=' ? a <= b
          : op === '>=' ? a >= b : op === '==' ? a === b : op === '!=' ? a !== b : false
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
