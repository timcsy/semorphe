/**
 * `cpp:char_is_alpha` 的 **execute** 路
 *
 * ⚠️ 字元可能以**數字碼**存放（陣列初始化列表、轉型的結果），
 * 所以不能一律 `String(value).charAt(0)`——`'a'` 存成 97 時那句會取到 `'9'`，
 * 於是 `isalpha('a')` 的答案來自一個不存在的字元。
 * 這個坑核心的轉型也踩過一次（`specs/109`）。
 */
import type { ConceptExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'

function charOf(v: RuntimeValue): string {
  if (v.type === 'char') {
    const s = String(v.value)
    return s.length === 1 && !/^\d$/.test(s) ? s : String.fromCharCode(Number(v.value))
  }
  if (typeof v.value === 'number') return String.fromCharCode(v.value)
  return String(v.value).charAt(0)
}

export function registerExecute(register: (concept: string, e: ConceptExecutor) => void): void {
  register('cpp:char_is_alpha', async (node, ctx) => {
    const v = (node.children.value ?? [])[0]
    if (!v) throw new Error('cpp:char_is_alpha 少了 value 子節點——語義樹壞了')
    const val = await ctx.evaluate(v)
    return { type: 'int', value: /[a-zA-Z]/.test(charOf(val)) ? 1 : 0 }
  })
}
