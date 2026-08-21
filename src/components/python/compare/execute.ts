/** `python:compare` 的 **execute** 路。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import type { RuntimeValue } from '../../../interpreter/types'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:compare', async (node, ctx) => {
    const op = String(node.properties.operator ?? '<')
    const l = await ctx.evaluate(node.children.left[0])
    const r = await ctx.evaluate(node.children.right[0])
    // 🔴 **等不等要先看型別**（2026-08-21）。
    //
    // 原本兩邊都走 `toNumber`，於是 `"" == None` 的兩邊都變成 0 而**相等**
    // ——真 Python 是 `False`。同樣地 `0 == "0"` 也會變成相等。
    //
    // ⚠️ 症狀是**不報錯、有輸出、而條件走錯邊**：參照直譯器抓到的。
    //
    // > **一個「先轉成數字再比」的等號，會讓所有轉出 0 的東西彼此相等。**
    if (op === '==' || op === '!=' || op === 'is' || op === 'is not') {
      const eq = pythonEquals(l, r)
      return { type: 'bool', value: op === '==' || op === 'is' ? eq : !eq }
    }
    // 兩邊都是字串時比字典序 —— Python 的字串是可比較的。
    const bothStr = l.type === 'string' && r.type === 'string'
    const a: string | number = bothStr ? String(l.value) : ctx.toNumber(l)
    const b: string | number = bothStr ? String(r.value) : ctx.toNumber(r)
    switch (op) {
      case '<': return { type: 'bool', value: a < b }
      case '>': return { type: 'bool', value: a > b }
      case '<=': return { type: 'bool', value: a <= b }
      case '>=': return { type: 'bool', value: a >= b }
      default: throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, { '%1': op })
    }
  })
}

/**
 * Python 的相等。
 *
 * ```
 * 數字家族（int／float／bool）  互相比得動 —— `1 == True` 是 True
 * 其餘                          型別不同就不等 —— `"" == None` 是 False
 * 容器                          逐格比
 * ```
 *
 * ⚠️ **`is` 與 `==` 在這裡做同一件事**——這個直譯器沒有物件識別，
 * 而 `x is None` 是它唯一常見的用途，那個用途上兩者一致。
 * 🔴 寫在這裡而不是靜靜地做：`a is b` 對兩個內容相同的串列，
 * 真 Python 是 `False` 而我們是 `True`。
 */
function pythonEquals(l: RuntimeValue, r: RuntimeValue): boolean {
  const numeric = (v: RuntimeValue): boolean =>
    v.type === 'int' || v.type === 'double' || v.type === 'float' || v.type === 'bool' || v.type === 'char'
  if (numeric(l) && numeric(r)) return Number(l.value) === Number(r.value)
  if (l.type !== r.type) return false
  if (l.type === 'void') return true
  if (Array.isArray(l.value) && Array.isArray(r.value)) {
    const a = l.value as RuntimeValue[], b = r.value as RuntimeValue[]
    return a.length === b.length && a.every((x, i) => pythonEquals(x, b[i]))
  }
  return l.value === r.value
}
