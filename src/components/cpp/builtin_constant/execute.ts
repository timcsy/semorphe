/** `cpp:builtin_constant` 的 **execute** 路——從共用檔原封剪過來（批次第三十批）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { CPP_BUILTIN_CONSTANTS } from '../../../languages/cpp/builtins'

export function registerExecute(register: (concept: string, executor: ComponentExecutor) => void): void {
  register('cpp:builtin_constant', async (node) => {
      const value = String(node.properties.value)
      const builtin = CPP_BUILTIN_CONSTANTS[value]
      if (builtin) return { type: builtin.type, value: builtin.value }
      return { type: 'int', value: 0 }
    })
}
