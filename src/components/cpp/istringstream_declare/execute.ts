/** `cpp:istringstream_declare` 的 **execute** 路——從共用檔原封剪過來（批次第二十五批：單一建立點 → 建構子）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:istringstream_declare', async (node, ctx) => {
      const name = String(node.properties.name ?? 'in')
      const src = node.children.source ?? []
      const text = src.length > 0 ? String((await ctx.evaluate(src[0])).value) : ''
      // 以**空白**切開，與 C++ 的 `>>` 一致（連續空白算一個分隔）
      const tokens = text.split(/\s+/).filter((s) => s.length > 0)
      ctx.scope.declare(name, {
        type: 'array',
        value: tokens.map((s) => ({ type: 'string' as const, value: s })),
      })
    })
}
