/**
 * `python:literal_bool` 的 **execute** 路。
 *
 * ⚠️ **用查表不用一串 `if`**——三個 `if (v === '…') return {…}` 會被第三十三條
 * 護欄當成「可能的靜默退路」而要求逐筆判定，**而它們其實是值的分派不是退路**。
 * 查表把「這三個值」寫成一份資料，意圖一眼看得出來。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

/**
 * 🔴 **`None` 用 `void`，不是新增一個 `null` 型別。**
 *
 * `RuntimeType` 是**所有語言共用**的（`interpreter/types.ts`），
 * 而為一個語言的關鍵字加一格，等於讓核心多認識一個 Python 的概念。
 * `void` 的意思正是「沒有值」——**那就是 `None` 的意思**。
 *
 * > **加一格到共用的型別表之前，先問「既有的哪一格說的是同一件事」。**
 */
const VALUES: Record<string, RuntimeValue> = {
  True: { type: 'bool', value: true },
  False: { type: 'bool', value: false },
  None: { type: 'void', value: null },
}

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('python:literal_bool', async (node) => {
    const v = String(node.properties.value ?? 'True')
    const hit = VALUES[v]
    // 判不出來就丟錯，不要回 false —— 那會讓壞掉的存檔看起來像一個假值。
    if (!hit) throw new RuntimeError(RUNTIME_ERRORS.UNRECOGNIZED_CODE, { '%1': v })
    return hit
  })
}
