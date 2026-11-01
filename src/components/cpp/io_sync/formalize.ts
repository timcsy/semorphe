/** `cpp:io_sync` 的 **formalize** 路（spec 199：6.0 量到學生的程式 135 支有 `ios::sync_with_stdio(0)`）。契約見 `core/formalize-contract.ts`。 */
import type { FormalizeRegistrar } from '../../../core/formalize-contract'
import { componentTraits } from '../../../core/component/traits'

/** C 的輸出入（printf／scanf 那一族，各自宣告了性狀 `ioStyle: 'cstdio'`）——與它們混用時，關掉同步會讓兩套緩衝的輸出順序未指定 */
const isCStdio = (id: string): boolean => componentTraits(id)?.ioStyle === 'cstdio'

export function registerFormalize(r: FormalizeRegistrar): void {
  // 只用 cout／cin 的程式：關不關同步，印出來的東西一樣——不產生建構子。
  // 混用 printf／scanf：輸出順序未指定，Cella 還沒有這個呼叫可以判——照實標 unknown，不猜（P6）
  r.stmt('cpp:io_sync', (n, f) => (f.programUses(isCStdio)
    ? [f.miss(n, '與 printf／scanf 混用時，關掉同步會讓輸出順序未指定——還判不了')]
    : []))
}
