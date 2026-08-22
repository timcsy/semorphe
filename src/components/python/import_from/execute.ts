/**
 * `python:import_from` 的 **execute** 路——**把那幾個名字綁進作用域**。
 *
 * 🔴 與 `import math` 的差別就在這裡：那一顆什麼都不做（模組的成員靠
 * 「整個名字當鍵」查得到），而這一顆**讓 `sqrt` 這個裸名字存在**。
 *
 * ⚠️ 綁的是**參照不是值**（`{ ref: 'builtin', name: 'math.sqrt' }`）——
 * 「這個名字該查誰」的順序只該有一份，住在呼叫的時候。
 *
 * ⚠️ 而**模組裡沒有那個名字時要出聲**：靜默綁一個空的，
 * 使用者會在呼叫的那一行看到一個莫名其妙的錯誤。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import { PYTHON_MODULE_METHODS, PYTHON_MODULE_MEMBERS } from '../../../languages/python/builtins'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:import_from', async (node, ctx) => {
    const mod = String(node.properties.module ?? 'math')
    for (const raw of String(node.properties.names ?? 'sqrt').split(',')) {
      const name = raw.trim()
      if (!name) continue
      const member = PYTHON_MODULE_MEMBERS[mod]?.[name]
      if (member) { bind(ctx, name, member); continue }
      if (PYTHON_MODULE_METHODS[`${mod}.${name}`]) {
        bind(ctx, name, { type: 'function', value: { ref: 'builtin', name: `${mod}.${name}` } })
        continue
      }
      throw new RuntimeError(RUNTIME_ERRORS.UNDEFINED_FUNCTION, { '%1': `${mod}.${name}` })
    }
  })
}

function bind(ctx: Parameters<ComponentExecutor>[1], name: string, value: Parameters<typeof bindRaw>[2]): void {
  bindRaw(ctx, name, value)
}
function bindRaw(
  ctx: Parameters<ComponentExecutor>[1], name: string,
  value: import('../../../interpreter/types').RuntimeValue,
): void {
  if (ctx.scope.hasLocal(name)) ctx.scope.set(name, value)
  else ctx.scope.declare(name, value)
}
