/**
 * `cpp:tone` 的 **lift** 路——**一筆資料，不是函式**。
 *
 * ⚠️ 第三個槽（`duration`）是**可選的**：`tone(pin, freq)` 只有兩個引數時，
 * 那個槽拿到空陣列——而 `generate.ts` 靠「空不空」決定產不產出第三個引數。
 */
import { registerCallConcept } from '../../../core/component/call-concepts'

export function registerLift(): void {
  registerCallConcept('tone', {
    conceptId: 'cpp:tone',
    argSlots: ['pin', 'frequency', 'duration'],
    source: 'cpp/tone',
  })
}
