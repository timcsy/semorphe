/**
 * `cpp:io_sync` 的 **lift** 路——**一筆資料：「這三個寫法屬於我」**
 *
 * ⚠️ 三個名字指向同一顆身分，因為 `ios` 繼承自 `ios_base`
 * ——`ios::sync_with_stdio` 與 `ios_base::sync_with_stdio` 是**同一個函式**。
 * 產出時正規化成前者（見 `generate.ts` 的理由）。
 */
import { registerCallConcept } from '../../../core/component/call-components'

export function registerLift(): void {
  registerCallConcept(
    ['ios::sync_with_stdio', 'ios_base::sync_with_stdio', 'std::ios::sync_with_stdio', 'std::ios_base::sync_with_stdio'],
    { componentId: 'cpp:io_sync', argSlots: ['value'], source: 'cpp/io_sync' },
  )
}
