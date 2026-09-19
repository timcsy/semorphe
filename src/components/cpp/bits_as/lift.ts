/**
 * `cpp:bits_as` 的 **lift** 路——**三筆資料，一顆身分**。
 *
 * ⚠️ 走「依接收者型別分派」那一張表：`to_string` 這種名字**登錄到以名字為鍵
 * 那一張會搶走任何接收者的同名方法**，而型別查不到時**不猜**是這個 repo 的立場。
 */
import { registerTypedMethodComponent } from '../../../core/component/method-components'

const NAMES = ['to_ulong', 'to_ullong', 'to_string'] as const

export function registerLift(): void {
  for (const m of NAMES) {
    registerTypedMethodComponent('bits', m, 'cpp:bits_as', 'cpp/bits_as')
  }
}
