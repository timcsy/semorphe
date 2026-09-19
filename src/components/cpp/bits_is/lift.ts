/**
 * `cpp:bits_is` 的 **lift** 路——**三筆資料，一顆身分**。
 *
 * ⚠️ 走「依接收者型別分派」那一張表（第三張）：`any`／`none`／`all` 都是
 * 很一般的方法名，**登錄到以名字為鍵那一張會搶走任何接收者的同名方法**
 * ——而 `method-components.ts` 逐字：「型別查不到時不猜，
 * 猜一個錯的專屬身分比誠實降級更糟。」
 *
 * 🔴 同族那顆「整排改值」在 2026-09-19 正是這樣犯過一次，
 * 被既有的「零引數的方法不得憑空多出插槽」那條護欄抓到。
 */
import { registerTypedMethodComponent } from '../../../core/component/method-components'

/** 三個問句、一顆身分——而**那個名字本身**就是它們的差別（進 `properties.method`）。 */
const NAMES = ['any', 'none', 'all'] as const

export function registerLift(): void {
  for (const m of NAMES) {
    registerTypedMethodComponent('bits', m, 'cpp:bits_is', 'cpp/bits_is')
  }
}
