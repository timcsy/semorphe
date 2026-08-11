/**
 * `cpp:cast_reinterpret` 的 **lift** 路——**一筆登錄**
 *
 * 判別「這是不是 `template_function` 形狀的呼叫」是 C++ 語法的知識，留在 `io.ts`；
 * **「`reinterpret_cast` 這個名字屬於我」是這顆元件的宣告。**
 */
import { registerNamedCast } from '../../../core/component/named-cast-concepts'

export function registerLift(): void {
  registerNamedCast('reinterpret_cast', 'cpp:cast_reinterpret', 'cpp/cast_reinterpret')
}
