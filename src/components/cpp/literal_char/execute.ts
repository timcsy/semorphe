/**
 * `cpp:literal_char` 的 **execute** 路——從 `core/executors/literals.ts` 原封搬過來。
 *
 * ⚠️ 值以**數字碼**存放（`charCodeAt`）。那是這個直譯器裡字元的兩種存法之一，
 * 而核心的轉型與 `cctype` 都因為沒認出這件事而出過錯（`specs/109`）。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

export function registerExecute(register: (concept: string, e: ComponentExecutor) => void): void {
  register('cpp:literal_char', async (node) => {
    const ch = String(node.properties.char ?? 'a')
    return { type: 'char', value: ch.charCodeAt(0) || 0 }
  })
}
