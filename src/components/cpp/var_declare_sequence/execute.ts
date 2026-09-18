/**
 * `cpp:var_declare_sequence` 的 **execute** 路——把右邊**按位置**拆開，分別命名。
 *
 * ⚠️ 拆開那件事與範圍 for 共用一份（`./bind`）——兩者拆的方式一模一樣，
 * 差別只在「拆的是誰」。寫兩份的話症狀會是「宣告式拆得開而迴圈裡拆不開」。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import { bindSequence } from './bind'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:var_declare_sequence', async (node, ctx) => {
    const names = (node.slots.targets ?? []).map((t) => String(t.properties.name ?? ''))
    const valueNodes = node.slots.value ?? []
    if (valueNodes.length === 0) {
      // C++ 不允許沒有初始值的結構化繫結——出聲，不要宣告一堆空名字。
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, {
        '%1': `「${names.join(', ')}」少了要拆開的那個值`,
      })
    }
    bindSequence(names, await ctx.evaluate(valueNodes[0]), ctx)
  })
}
