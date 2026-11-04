/** `cpp:io_sync` 的 **formalize** 路（spec 199：6.0 量到學生的程式 135 支有 `ios::sync_with_stdio(0)`）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'
import { componentTraits } from '../../../core/component/traits'

/** C 的輸出入（printf／scanf 那一族，各自宣告了性狀 `ioStyle: 'cstdio'`）——與它們混用時，關掉同步會讓兩套緩衝的輸出順序未指定 */
const isCStdio = (id: string): boolean => componentTraits(id)?.ioStyle === 'cstdio'
/** C++ 串流的輸出入（cout／cin，`ioRole` 帶 `ioStyle: 'iostream'`）——`endl` 有風格沒有角色，不算 */
const isIostream = (id: string): boolean => componentTraits(id)?.ioStyle === 'iostream' && componentTraits(id)?.ioRole !== undefined

export function registerFormalize(r: FormalizeRegistrar): void {
  // 只用 cout／cin、或只用 printf／scanf 的程式：關不關同步，印出來的東西一樣——不產生建構子。
  // 🔴 兩套【混用】才是輸出順序未指定（Cella 還沒有這個呼叫可以判——照實標 unknown，不猜，P6）。
  //    原本只問「有沒有 printf／scanf」：spec 215 把整支換成 printf 之後（同步關不關已經無關），學生語料 40 支因此翻不出。
  r.stmt('cpp:io_sync', (n, f) => (f.programUses(isCStdio) && f.programUses(isIostream)
    ? [f.miss(n, '與 printf／scanf 混用時，關掉同步會讓輸出順序未指定——還判不了')]
    : []))
}
