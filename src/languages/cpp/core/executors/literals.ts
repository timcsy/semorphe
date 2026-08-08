/**
 * literals 的語言專屬執行路——2 個。
 *
 * 通用的那些留在核心（拔掉 C++ 之後仍然存在，不是違規）；
 * 這裡是語言專屬的部分。歸屬由概念定義的層級欄位決定，不由檔名。
 *
 * 見 specs/055-finish-executor-move/
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'
import { CPP_BUILTIN_CONSTANTS } from '../../builtins'

export function registerLiteralsCoreExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {
  register('cpp_char_literal', async (node) => {
    const ch = String(node.properties.char ?? 'a')
    return { type: 'char', value: ch.charCodeAt(0) || 0 }
  })

  register('builtin_constant', async (node) => {
    const value = String(node.properties.value)
    const builtin = CPP_BUILTIN_CONSTANTS[value]
    if (builtin) return { type: builtin.type, value: builtin.value }
    return { type: 'int', value: 0 }
  })
}
