/** `cpp:string_find` 的 **execute** 路——從共用檔原封剪過來（批次第五批：lift 是 io.ts 的方法 case（純資料））。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:string_find', async (node, ctx) => {
      // 🔴 **接收者求值，不再解析一串文字**（2026-09-18）——見 `component.json` 的 `_slots_why`
      const val = await ctx.evaluate((node.slots.obj ?? [])[0])
      const str = String(val.value)
      const argNodes = node.slots.arg ?? []
      if (argNodes.length === 0) return { type: 'int', value: -1 }
      const sub = String((await ctx.evaluate(argNodes[0])).value)
      const fromNodes = node.slots.from ?? []
      const from = fromNodes.length > 0 ? ctx.toNumber(await ctx.evaluate(fromNodes[0])) : 0
      const idx = str.indexOf(sub, from)
      // 找不到時 C++ 回 `string::npos`。而**使用者常寫 `!= -1` 來比**——
      // 回 4294967295 的話那個比較永遠成立，迴圈停不下來。
      // 回 -1：`!= -1` 與 `!= string::npos` 兩種寫法都對，而 npos 本身
      // 在這個直譯器裡沒有被表示成一個常數。
      return { type: 'int', value: idx }
    })
}
