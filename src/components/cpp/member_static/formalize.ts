/**
 * `cpp:member_static` 的 **formalize** 路（spec 203）——類別成員 `mbStatic acc n x name t init`（[class.static.data]：所有物件共用一份）。
 * 語義樹的這顆沒有初值（類別外的定義 `int A::t = 0;` 是另一顆頂層宣告，這裡不收）→ `init` 送 null。存取權由類別那顆蓋上。契約見 `core/formalize-contract.ts`。
 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.member('cpp:member_static', (n, f) => {
    const t = f.type(n.properties?.type, n)
    return f.k('mbStatic', { acc: f.k('acPublic'), n: n.id, x: n.id, name: String(n.properties?.name ?? ''), t, init: null })
  })
  // 作用域：成員函式裡的裸名字指到它（宣告 id 就是 mbStatic 的 x）
  r.scope('cpp:member_static', (n, w) => { if (n.properties?.name) w.declare(String(n.properties.name), n.id) })
}
