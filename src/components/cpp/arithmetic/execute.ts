/** `cpp:arithmetic` 的 **execute** 路——從共用檔原封剪過來（批次第三十六批：字面值與二元運算子）。 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (concept: string, executor: ConceptExecutor) => void): void {
  register('cpp:arithmetic', async (node, ctx) => {
      const op = String(node.properties.operator)
      const left = await ctx.evaluate(node.children.left[0])

      // 左邊是物件時，問它的型別有沒有多載這個運算子。
      //
      // ⚠️ **重用上面那次求值，不要再求一次。** 第一版在函式開頭多求值了一次
      // 左運算元，於是每個算術節點的工作量翻倍——遞迴的 fibonacci 直接爆
      // 步數上限。單元測試全綠，抓到它的是**跑真實程式**的那批測試。
      if (left.type === 'object') {
        const m = ctx.structs.method(left.structName ?? '', `operator${op}`)
        if (m) {
          const r = await ctx.structs.invoke(left, m, [node.children.right[0]])
          if (r !== undefined) return r
        }
        // 落到下面的數值運算會把物件轉成 NaN，而那會印出一個數字，
        // 看起來像跑成功了。出聲。
        throw new RuntimeError(RUNTIME_ERRORS.UNDEFINED_FUNCTION, {
          '%1': `${left.structName ?? '物件'} 沒有多載 operator${op}`,
        })
      }

      const right = await ctx.evaluate(node.children.right[0])

      // **指標算術**：`p = p + 2`、`p - 1`。
      //
      // 實體式指標（`new`／`malloc`／陣列退化）在這個直譯器裡是
      // 「一個陣列 ＋ 一個 `offset`」（見 `cpp:address_of`）。所以移動指標
      // 就是**移動 offset**，而底下那個陣列**不複製**——`*(p+2) = 9` 要寫得回去。
      //
      // ⚠️ 走一般的數值路徑會讓 `p + 2` 變成 `toNumber(陣列) + 2 = 2`，
      // 而那是一個看起來像數字的東西，後面每次解參考都報 `TYPE_MISMATCH`。
      if ((op === '+' || op === '-') && left.type === 'array' && Array.isArray(left.value) && right.type !== 'array') {
        const step = ctx.toNumber(right)
        const moved = (left.offset ?? 0) + (op === '+' ? step : -step)
        // ⚠️ **不在這裡檢查越界**：C++ 允許指標指到「尾端之後一格」（`end()` 的慣例），
        // 只有**解參考**才是錯的。而 `pointer_deref`／`pointer_assign` 已經在檢查。
        return { type: 'array', value: left.value, offset: moved }
      }

      const lv = ctx.toNumber(left)
      const rv = ctx.toNumber(right)

      let result: number
      switch (op) {
        case '+': result = lv + rv; break
        case '-': result = lv - rv; break
        case '*': result = lv * rv; break
        case '/':
          if (rv === 0) throw new RuntimeError(RUNTIME_ERRORS.DIVISION_BY_ZERO)
          result = lv / rv; break
        case '%':
          if (rv === 0) throw new RuntimeError(RUNTIME_ERRORS.DIVISION_BY_ZERO)
          result = lv % rv; break
        case '&': result = lv & rv; break
        case '|': result = lv | rv; break
        case '^': result = lv ^ rv; break
        case '<<': result = lv << rv; break
        case '>>': result = lv >> rv; break
        default: result = 0
      }

      if (left.type === 'int' && right.type === 'int') {
        return { type: 'int', value: Math.trunc(result) }
      }
      return { type: 'double', value: result }
    })
}
