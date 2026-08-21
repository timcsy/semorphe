/**
 * `python:container_find` 的 **execute** 路——串列比值、字典比鍵、字串比子字串。
 *
 * ⚠️ **字典比的是【鍵】不是值**——`"小明" in ages` 問的是有沒有這個名字，
 * 不是有沒有這個分數。把它做成比值是 Python 初學者最常見的誤解之一，
 * 而工具做錯的話學生會學到錯的模型。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue, ObjectFields } from '../../../interpreter/types'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:container_find', async (node, ctx) => {
    const needle = await ctx.evaluate(node.children.needle[0])
    const hay = await ctx.evaluate(node.children.haystack[0])
    const negated = String(node.properties.operator ?? 'in').includes('not')

    let found: boolean
    if (hay.type === 'object') found = (hay.value as ObjectFields).has(String(needle.value))
    else if (hay.type === 'string') found = String(hay.value).includes(String(needle.value))
    else found = (hay.value as RuntimeValue[]).some((v) => String(v.value) === String(needle.value))

    return { type: 'bool', value: negated ? !found : found }
  })
}
