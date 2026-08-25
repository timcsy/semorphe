/** `cpp:string_at` 的 **execute** 路——從共用檔原封剪過來（批次第二十四批：單一建立點 → 建構子）。 */
import type { ComponentExecutor, ExecutionContext } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { declareLvalue } from '../../../core/component/lvalue-nodes'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  registerLvalue()
  register('cpp:string_at', async (node, ctx) => {
      const obj = String(node.properties.obj)
      const val = ctx.scope.get(obj)
      const str = String(val.value)
      const indexNodes = node.children.index ?? []
      const idx = indexNodes.length > 0 ? ctx.toNumber(await ctx.evaluate(indexNodes[0])) : 0
      if (idx < 0 || idx >= str.length) throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE)
      // ⚠️ `s[i]` 的型別是 **char**，而 char 在這個直譯器裡是**碼位（數字）**
      // ——`cpp:literal_char` 就是那樣回的（`{ type: 'char', value: ch.charCodeAt(0) }`）。
      //
      // 🔴 這裡原本回 `{ type: 'string', value: 'a' }`，於是 `s[i] - 32` 走
      // `toNumber` 的 `Number('a') || 0` **變成 0**，算出 -32。
      // 而 `s[i] >= 'a'` 是對的（比較另有處理），所以症狀只出現在算術上：
      // 大小寫轉換那一族全部靜靜地不動。
      //
      // > **同一個概念有三種表示時，錯的那一種只會在某些運算下現形。**
      return { type: 'char', value: str.charCodeAt(idx) }
    })
}

/**
 * **我可以被寫回**——`s[i] -= 7`。C++ 的 `string::operator[]` 回的是參照，
 * 所以它**是**左值。
 *
 * 🔴 而這個直譯器裡字串是**不可變**的（一個 JS string），
 * 所以寫回那一格要**重建整個字串再寫回變數**。
 * ⚠️ 讀出來是**碼位**（與求值那一側同一個決定，見上面那段註解）——
 * 寫回時也要當碼位還原，否則 `s[0] -= 7` 會把整格變成一個數字。
 */
export function registerLvalue(): void {
  declareLvalue('cpp:string_at', async (node, ctx: ExecutionContext) => {
    const name = String(node.properties.obj)
    const current = ctx.scope.get(name)
    const text = String(current.value)
    const indexNodes = node.children.index ?? []
    const idx = indexNodes.length > 0
      ? Math.trunc(ctx.toNumber(await ctx.evaluate(indexNodes[0]))) : 0
    if (idx < 0 || idx >= text.length) {
      throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(idx) })
    }
    return {
      read: (): RuntimeValue => ({ type: 'char', value: text.charCodeAt(idx) }),
      write: (v) => {
        const rv = v as RuntimeValue
        const code = rv.type === 'char' ? Number(rv.value) : ctx.toNumber(rv)
        const chars = text.split('')
        chars[idx] = String.fromCharCode(Math.trunc(code))
        ctx.scope.set(name, { type: 'string', value: chars.join('') })
      },
    }
  })
}
