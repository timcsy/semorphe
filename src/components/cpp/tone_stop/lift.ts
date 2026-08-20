/**
 * `cpp:tone_stop` 的 **lift** 路——**一筆資料，不是函式**。
 *
 * ⚠️ 函式名是 `noTone`，而身分是 `cpp:tone_stop`——**名字描述語義動作，不抄語法**。
 */
import { registerCallComponent } from '../../../core/component/call-components'

export function registerLift(): void {
  registerCallComponent('noTone', {
    componentId: 'cpp:tone_stop',
    argSlots: ['pin'],
    source: 'cpp/tone_stop',
  })
}
