/**
 * `cpp:literal_number` 的 **execute** 路——從共用檔原封剪過來（批次第三十六批：字面值與二元運算子）。
 *
 * ## 🔴 而 2026-08-17 的盲測抓到它把後綴吃成 `NaN`
 *
 * ```
 * 5           🟢 5
 * 0xFF        🟢 255
 * 5L          🔴 NaN
 * 7U          🔴 NaN
 * 4294967295UL 🔴 NaN
 * 1.5f        🔴 NaN
 * ```
 *
 * `Number('5L')` 是 `NaN`——**而它不出聲**，一路往下傳成
 * 「`NaN 0` / `NaN 0` / …」這種看起來像功能壞掉、而其實是**一個字面值沒被讀懂**的輸出。
 *
 * > **一個回 `NaN` 而不出聲的求值，會讓錯誤出現在離根因很遠的地方。**
 *
 * ⚠️ 而它是 `component-fuzz` 抓到的，不是我的測試——我寫測試時
 * **不會想到去寫 `5L`**，因為我知道實作只做了 `Number()`。
 * 那正是資訊隔離盲測存在的理由。
 *
 * ## 後綴的語義
 *
 * C++ 的整數後綴（`u`／`U`／`l`／`L`／`ll`／`LL` 任意組合）與浮點後綴
 * （`f`／`F`／`l`／`L`）**只影響型別，不影響值**。這個直譯器的數值模型是
 * JavaScript 的 `number`，⚠️ **所以後綴在這裡只需要被【剝掉】，不需要被實現**
 * ——而「不需要實現」與「可以忽略」是兩件事：忽略的話值就變成 `NaN`。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'

/** 整數／浮點的字面後綴。**只影響型別，不影響值**——見檔頭。 */
const SUFFIX = /(?:[uU]|[lL]{1,2}|[fF])+$/

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:literal_number', async (node) => {
      const raw = String(node.properties.value)
      // ⚠️ 十六進位／二進位不能剝：`0xFF` 的 `F` 是數字不是後綴。
      const bare = /^0[xXbB]/.test(raw) ? raw : raw.replace(SUFFIX, '')
      const num = Number(bare)
      // 🔴 **判不出來就出聲**——回 `NaN` 的話錯誤會出現在離根因很遠的地方
      //（第三十三條護欄「靜默回退」在看這個）。
      if (Number.isNaN(num)) {
        throw new Error(`讀不懂這個數字字面：${JSON.stringify(raw)}`)
      }
      // ⚠️ 浮點後綴（`1.5f`）也要算成 double——判準是**剝掉後綴之後**有沒有小數點
      if (bare.includes('.') || /[eE]/.test(bare)) {
        return { type: 'double', value: num }
      }
      return { type: 'int', value: Math.trunc(num) }
    })
}
