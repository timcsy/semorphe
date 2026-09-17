/**
 * `cpp:set_declare` 的 **lift** 路——**兩筆資料：「`set` 與 `multiset` 這兩個型別名屬於我」**
 *
 * 原本住在 `pending-containers.ts` 的過渡表裡。那張表的檔頭寫著
 * 「每搬一顆進膠囊，就從這裡刪掉一列。這張表歸零的那天就刪掉這個檔」
 * ——**這一批就是那一天。**
 *
 * ## 🔴 為什麼是同一顆，而差別寫在附帶屬性上（2026-09-17）
 *
 * 允不允許重複，C++ 自己的判準是**接收者的型別**決定的：同一個方法名
 * `insert`，在兩種容器上做不同的事。所以那個差別屬於**容器的宣告**，
 * 不屬於方法——而兩種宣告是同一個概念的兩個值，不是兩個概念。
 *
 * ⚠️ 拆成兩顆的代價是具體的：`insert` 這個方法名會有兩個主人，
 * 而登錄表當場拒絕（「不自動取其一——靜默覆蓋的症狀是
 * 『某個方法被辨識成另一個概念』」）。
 */
import { registerContainerTemplate } from '../../../core/component/container-templates'

export function registerLift(): void {
  registerContainerTemplate('set', 'cpp:set_declare', 'cpp/set_declare', { unique: 'true' })
  registerContainerTemplate('multiset', 'cpp:set_declare', 'cpp/set_declare', { unique: 'false' })
}
