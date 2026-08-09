/**
 * functions 的語言專屬執行路——6 個。
 *
 * 通用的那些留在核心（拔掉 C++ 之後仍然存在，不是違規）；
 * 這裡是語言專屬的部分。歸屬由概念定義的層級欄位決定，不由檔名。
 *
 * 見 specs/055-finish-executor-move/
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../../interpreter/types'

class ReturnSignal {
  value: RuntimeValue
  constructor(value: RuntimeValue) { this.value = value }
}

export { ReturnSignal }

export function registerFunctionsCoreExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {
  register('cpp:forward_decl', async () => {
    // no-op: forward function declaration
  })

  // OOP concepts — noop in interpreter (no OOP runtime)

  register('cpp:struct_at_member', async () => {})

  register('cpp:struct_at_ptr', async () => {})

  register('cpp:method_call', async () => {})


  // 註：物件導向那批「已知缺口」的空操作集中在 interpreter.ts 的缺口清單，
  // 那裡有不能直接刪的理由。原本這裡也各註冊一次，兩邊互相覆蓋——行為相同，
  // 但同一個病（勝負靠載入順序）。四個具名轉型的實作在 operators.ts。
  // 見 specs/053-declare-noop-execute/research.md F8。

  register('cpp:template_function', async () => {})
}
