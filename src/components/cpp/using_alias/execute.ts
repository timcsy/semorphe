/**
 * `cpp:using_alias` 的 **execute** 路——**登記那個別名**。
 *
 * ## 🔴 它在此之前是一個 noop（2026-09-20，資訊隔離盲測抓到）
 *
 * `using Row = bitset<8>;` 與 `typedef bitset<8> Row;` **是同一件事**，
 * 而同族那顆（`typedef`）早就在執行期登記別名了——它的檔頭逐字寫著為什麼：
 *
 * > **一個別名的意義就是那個短名字；把它換掉等於把它拿掉。**
 * >（所以不在 lift 期展開，只在執行那一側解開。）
 *
 * ⚠️ 而這一顆只寫了 `async () => {}`，於是 `Row r;` 的 `r` 被建成一個 `int 0`
 * ——**症狀說「r 不是一個物件（它是 int）」，而 `int` 那個字是預設值**，
 * 也就是「我完全不知道 r 是什麼」。
 *
 * > **同一件事的第二種寫法，會在第一種寫法的機制上安靜地缺席
 * > ——而一個 noop 讓「還沒做」與「不必做」長得一模一樣。**
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { setAlias } from '../../../interpreter/aliases'

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:using_alias', async (node) => {
    // ⚠️ **不寫退路**——沒有就不做（同族那顆記過：在這裡補一個值等於登記一個沒有人寫過的別名）。
    const alias = node.properties.alias
    const orig = node.properties.orig_type
    if (typeof alias === 'string' && typeof orig === 'string') setAlias(alias, orig)
  })
}
