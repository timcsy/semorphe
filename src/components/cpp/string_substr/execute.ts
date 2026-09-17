/** `cpp:string_substr` 的 **execute** 路——從共用檔原封剪過來（批次第五批：lift 是 io.ts 的方法 case（純資料））。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:string_substr', async (node, ctx) => {
      // 🔴 **接收者求值，不再解析一串文字**（2026-09-18）——見 `component.json` 的 `_slots_why`
      const val = await ctx.evaluate((node.slots.obj ?? [])[0])
      const str = String(val.value)
      const posNodes = node.slots.pos ?? []
      const lenNodes = node.slots.len ?? []
      const pos = posNodes.length > 0 ? ctx.toNumber(await ctx.evaluate(posNodes[0])) : 0
      const len = lenNodes.length > 0 ? ctx.toNumber(await ctx.evaluate(lenNodes[0])) : str.length - pos
      return { type: 'string', value: str.substring(pos, pos + len) }
    })
}
