/**
 * `cpp:io_mode_number` 的 **execute** 路——**設一格串流狀態，然後印零個字**。
 *
 * ⚠️ 它**改變「小數位數」的意思**：預設那一路的位數是「總共幾位有效數字」（C 的 `%g`），
 *    而固定小數那一路是「小數點後幾位」。兩條規則住在 `runtime/stream-state.ts`。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { streamState } from '../../../languages/cpp/lang/runtime/stream-state'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:io_mode_number', async (node, ctx) => {
    const st = streamState(ctx.io as unknown as object)
    st.notation = node.properties.notation === 'scientific' ? 'scientific' : 'fixed'
    return { type: 'string' as const, value: '' }
  })
}
