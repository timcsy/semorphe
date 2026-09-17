/** `cpp:typedef` 的 **execute** 路——從共用檔原封剪過來（批次第三批：lift 是只產一種身分的具名策略）。 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { setAlias } from '../../../interpreter/aliases'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  /**
   * 🔴 **一個型別別名在執行期也要查得到**（2026-09-18，資訊隔離的盲測）。
   *
   * ```cpp
   * typedef map<int, set<int>> Graph;
   * Graph g;  g[a].insert(b);      我們：`g` 是一個普通變數 → 「不是容器」
   * ```
   *
   * ⚠️ **而它不在 lift 期展開**——展開的話產出的程式碼會變成
   * `map<int, set<int>> g;`，那是一支**與學生寫的不同**的程式。
   * > **一個別名的意義就是那個短名字；把它換掉等於把它拿掉。**
   *
   * 🟢 所以只在**執行**那一側解開：宣告那一路問「這個型別是不是一個容器」時
   * 先過一次別名表。表本身早就有了（`interpreter/aliases`，`#define` 在用）。
   */
  register('cpp:typedef', async (node) => {
    // ⚠️ **不寫退路**：宣告的 default 是 `myint`／`int`，而在這裡補那個值等於
    //    登記一個沒有人寫過的別名。**沒有就不做**（第一百一十九條：規格不得說謊）。
    const alias = node.properties.alias
    const orig = node.properties.orig_type
    if (typeof alias === 'string' && typeof orig === 'string') setAlias(alias, orig)
  })
}
