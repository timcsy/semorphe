/**
 * `python:member_at` 的 **execute** 路。
 *
 * 🔴 **模組成員由內建表提供**——這個直譯器沒有模組系統，
 * 而 `math.pi` 在教學語料裡到處都是。認不得的成員**丟錯**，不回 None：
 * 靜默的話 `print(math.tau)` 印出 `None` 而看不出是我們沒做。
 */
import type { ComponentExecutor, ExecutionContext } from '../../../interpreter/executor-registry'
import { declareLvalue } from '../../../core/component/lvalue-nodes'
import type { ObjectFields } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'
import { PYTHON_MODULE_MEMBERS, moduleNameOf } from '../../../languages/python/builtins'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  registerLvalue()
  register('python:member_at', async (node, ctx) => {
    const member = String(node.properties.member ?? '')
    const objNode = (node.children.obj ?? [])[0]

    // `math.pi` —— 物件是一個**模組名**，作用域裡沒有這個變數
    // ⚠️ `import math as m` 之後接收者是 `m`——**它在作用域裡**，而它指向 `math`。
    const objName = objNode ? String(objNode.properties?.name ?? '') : ''
    const modName = moduleNameOf(objName, ctx.scope)
    const mod = modName ? PYTHON_MODULE_MEMBERS[modName] : undefined
    if (mod) {
      const got = mod[member]
      if (got === undefined) {
        throw new RuntimeError(RUNTIME_ERRORS.UNDEFINED_FUNCTION, { '%1': `${modName}.${member}` })
      }
      return got
    }

    const obj = objNode ? await ctx.evaluate(objNode) : { type: 'void' as const, value: null }
    if (obj.type === 'object') {
      const got = (obj.value as ObjectFields).get(member)
      if (got === undefined) throw new RuntimeError(RUNTIME_ERRORS.KEY_NOT_FOUND, { '%1': member })
      return got
    }
    throw new RuntimeError(RUNTIME_ERRORS.UNDEFINED_FUNCTION, { '%1': `${objName}.${member}` })
  })
}

/**
 * **我可以被寫回**——物件的一個欄位（`a.b`）。
 *
 * 🟢 **`a.b.c` 因此解得出來**：接收者是**另一顆節點**（可能又是一顆 `member_at`），
 * 求它的值回傳的是同一個物件（`Map` 是參照）。
 * 🔴 **求值的是接收者，不是整個左邊**——整個左邊求值會讀出那個欄位現在的值。
 */
export function registerLvalue(): void {
  declareLvalue('python:member_at', async (node, ctx: ExecutionContext) => {
    const recvNode = (node.children.obj ?? [])[0]
    const field = String(node.properties.member ?? '')
    if (!recvNode || !field) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': '這個左邊不是「某個東西的欄位」' })
    }
    const recv = await ctx.evaluate(recvNode)
    if (recv.type !== 'object') {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': `${field} 的接收者不是一個物件` })
    }
    const fields = recv.value as ObjectFields
    return {
      read: () => {
        const got = fields.get(field)
        if (got === undefined) throw new RuntimeError(RUNTIME_ERRORS.KEY_NOT_FOUND, { '%1': field })
        return got
      },
      write: (v) => { fields.set(field, v as never) },
    }
  })
}
