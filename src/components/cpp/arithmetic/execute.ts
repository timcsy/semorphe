/** `cpp:arithmetic` 的 **execute** 路——從共用檔原封剪過來（批次第三十六批：字面值與二元運算子）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
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
      // **兩個指標相減 ＝ 中間隔幾格**（`it - v.begin()` 是最常見的用法：
      // 把一個位置換算成索引）。
      //
      // ⚠️ 這一條必須在下面那條之前：下面那條要求右邊**不是**陣列，
      // 所以兩個指標相減會落到數值路徑，變成 `toNumber(陣列) - toNumber(陣列) = 0`
      // ——**一個看起來很合理的索引 0**，而每一次二分搜都會回報「找到第 0 個」。
      if (op === '-' && left.type === 'array' && right.type === 'array') {
        if (left.value !== right.value) {
          throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, {
            '%1': '兩個位置不在同一個容器裡，相減沒有意義',
          })
        }
        return { type: 'int', value: (left.offset ?? 0) - (right.offset ?? 0) }
      }

      if ((op === '+' || op === '-') && left.type === 'array' && Array.isArray(left.value) && right.type !== 'array') {
        const step = ctx.toNumber(right)
        const moved = (left.offset ?? 0) + (op === '+' ? step : -step)
        // ⚠️ **不在這裡檢查越界**：C++ 允許指標指到「尾端之後一格」（`end()` 的慣例），
        // 只有**解參考**才是錯的。而 `pointer_deref`／`pointer_assign` 已經在檢查。
        return { type: 'array', value: left.value, offset: moved }
      }

      // **字串的 `+` 是串接**。`s + s[i]`、`s1 + s2`、`"x" + s`。
      //
      // 🔴 走數值路徑的話 `toNumber("ab")` 是 0、右邊是碼位，於是
      // `"ab" + 'a'` 變成 **97**——與 `+=` 那一筆（第五輪修的）是同一個根因的
      // 另一半，而**當時只修了 `+=`**。
      //
      // > **一個運算子有複合形式與二元形式時，修一個不會修到另一個
      // > ——而它們錯的是同一件事。**
      //
      // ⚠️ 判準是「**任一邊是 string**」：`char + int` 仍然是數值（C++ 的整數提升），
      // 只有真的有字串參與時才串接。
      if (op === '+' && (left.type === 'string' || right.type === 'string')) {
        const piece = (v: typeof left): string =>
          v.type === 'char' ? String.fromCharCode(ctx.toNumber(v)) : String(v.value)
        return { type: 'string', value: piece(left) + piece(right) }
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
