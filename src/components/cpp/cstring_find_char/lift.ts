/**
 * `cpp:cstring_find_char` 的 **lift** 路——**一筆登錄**
 *
 * 判別「這是不是一個函式呼叫」是 C++ 語法的知識，留在 `io.ts`；
 * **「`strchr` 這個名字屬於我」是這顆元件的宣告。**
 * 兩個引數各有名字，所以走 `registerCallConcept` 帶 `argSlots`。
 */
import { registerCallConcept } from '../../../core/component/call-components'

export function registerLift(): void {
  registerCallConcept('strchr', {
    componentId: 'cpp:cstring_find_char',
    argSlots: ['str', 'ch'],
    source: 'cpp/cstring_find_char',
  })
}
