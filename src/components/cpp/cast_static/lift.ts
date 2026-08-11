/**
 * `cpp:cast_static` 的 **lift** 路——**一筆登錄**
 *
 * 判別「這是不是 `template_function` 形狀的呼叫」是 C++ 語法的知識，留在 `io.ts`；
 * **「`static_cast` 這個名字屬於我」是這顆元件的宣告。**
 */
import { registerNamedCast } from '../../../core/component/named-cast-concepts'

export function registerLift(): void {
  registerNamedCast('static_cast', 'cpp:cast_static', 'cpp/cast_static')
}
