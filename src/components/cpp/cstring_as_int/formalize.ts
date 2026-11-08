/**
 * `cpp:cstring_as_int` 的 **formalize** 路——`atoi(s)`（`<cstdlib>`）。原本沒有這一路，整支程式翻不出
 * （2026-11-08，學生語料 tioj_godteach/pratice_question/10_ex2_2 是唯一卡在這裡的一支）。在 Cella 是一般的函式呼叫。
 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.expr('cpp:cstring_as_int', (n, f) => f.call(n, 'atoi', ['str']))
}
