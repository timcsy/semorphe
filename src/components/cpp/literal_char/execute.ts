/**
 * `cpp:literal_char` 的 **execute** 路——從 `core/executors/literals.ts` 原封搬過來。
 *
 * ⚠️ 值以**數字碼**存放（`charCodeAt`）。那是這個直譯器裡字元的兩種存法之一，
 * 而核心的轉型與 `cctype` 都因為沒認出這件事而出過錯（`specs/109`）。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { unescapeC } from '../../../core/registry/transform-registry'

export function registerExecute(register: (component: string, e: ComponentExecutor) => void): void {
  register('cpp:literal_char', async (node) => {
    /**
     * 🔴 **`properties.char` 存的是原始碼裡引號中間那段【文字】**，不是那個字元。
     *
     *    `'\n'` 存的是兩個字元（`\` 與 `n`）。在此之前這裡直接 `charCodeAt(0)`，
     *    於是 `cout << '\n'` 印出一個**反斜線**。
     *
     * ⚠️ 而它**來回一趟是對的**——產生器照樣吐回 `'\n'`，所以
     *    第一百一十五／一百一十七／一百一十八條（形狀）全綠，
     *    ①②③④ 四個面向一個都看不到它。抓到它的是第五個面向：
     *    **拿真實的學生程式，跟參照編譯器比跑出來的東西**（2026-09-16）。
     *
     * > **一個只錯在 execute 那一路的缺陷，形狀是完美的
     * > ——而形狀完美正是它活下來的原因。**
     *
     * 🟢 字串那一路早就在用 `unescapeC`（`literal_string/execute.ts`），
     *    這裡只是漏了。同一份解跳脫，不另寫一份。
     */
    const ch = unescapeC(String(node.properties.char ?? 'a'))
    return { type: 'char', value: ch.charCodeAt(0) || 0 }
  })
}
