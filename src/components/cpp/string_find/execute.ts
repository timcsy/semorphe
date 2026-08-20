/** `cpp:string_find` 的 **execute** 路——從共用檔原封剪過來（批次第五批：lift 是 io.ts 的方法 case（純資料））。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:string_find', async (node, ctx) => {
      const obj = String(node.properties.obj)
      const val = ctx.scope.get(obj)
      const str = String(val.value)
      const argNodes = node.children.arg ?? []
      if (argNodes.length === 0) return { type: 'int', value: -1 }
      const sub = String((await ctx.evaluate(argNodes[0])).value)
      const fromNodes = node.children.from ?? []
      const from = fromNodes.length > 0 ? ctx.toNumber(await ctx.evaluate(fromNodes[0])) : 0
      const idx = str.indexOf(sub, from)
      // 找不到時 C++ 回 `string::npos`。而**使用者常寫 `!= -1` 來比**——
      // 回 4294967295 的話那個比較永遠成立，迴圈停不下來。
      // 回 -1：`!= -1` 與 `!= string::npos` 兩種寫法都對，而 npos 本身
      // 在這個直譯器裡沒有被表示成一個常數。
      return { type: 'int', value: idx }
    })
}
