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
