/**
 * `cpp:char_to_lower` 的 **lift** 路——**一筆登錄**
 *
 * 判別「這是不是一個函式呼叫」是 C++ 語法的知識，留在 `io.ts`；
 * **「`tolower` 這個名字屬於我」是這顆元件的宣告。**
 * 單引數自由函式——`registerSingleArgFunction` 是它的專用入口。
 */
import { registerSingleArgFunction } from '../../../core/component/call-concepts'

export function registerLift(): void {
  registerSingleArgFunction('tolower', 'cpp:char_to_lower', 'cpp/char_to_lower')
}
