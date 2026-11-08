/**
 * `cpp:member_static` 的 **formalize** 路（spec 203）——類別成員 `mbStatic acc n x name t init`（[class.static.data]：所有物件共用一份）。
 * 初值：類別外的定義（`int A::t = 0;` 是另一顆頂層宣告）由核心的 `staticInitOf` 找回來併進這裡（361；cella 的送法），定義本身不另外送；沒有就 null。存取權由類別那顆蓋上。契約見 `core/formalize-contract.ts`。
 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'

export function registerFormalize(r: FormalizeRegistrar): void {
  r.member('cpp:member_static', (n, f) => {
    const t = f.type(n.properties?.type, n)
    // 初值來自類別外的定義（`int C::n = 3;`，361；cella 2026-11-08 的送法）；兩邊都沒有 ⟹ null（照標準零初始化）
    const initNode = f.staticInitOf(n)
    return f.k('mbStatic', { acc: f.k('acPublic'), n: n.id, x: n.id, name: String(n.properties?.name ?? ''), t, init: initNode ? f.initOf(initNode) : null })
  })
  // 作用域：成員函式裡的裸名字指到它（宣告 id 就是 mbStatic 的 x）
  r.scope('cpp:member_static', (n, w) => { if (n.properties?.name) w.declare(String(n.properties.name), n.id) })
}
