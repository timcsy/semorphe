/**
 * `python:import` 的 **execute** 路——**把名字綁上模組**。
 *
 * 🔴 綁的名字是**別名或模組名**（`import math as m` 綁 `m`），
 * 而值只記「指向哪個模組」——成員一律回內建表查。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { moduleRefValue } from '../../../languages/python/builtins'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:import', async (node, ctx) => {
    const target = String(node.properties.name ?? 'math')
    const bound = String(node.properties.alias ?? '').trim() || target
    if (!bound) return
    const v = moduleRefValue(target)
    if (ctx.scope.hasLocal(bound)) ctx.scope.set(bound, v)
    else ctx.scope.declare(bound, v)
  })
}
