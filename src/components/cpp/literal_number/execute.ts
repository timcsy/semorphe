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
import { narrow } from '../../../interpreter/int64'

/** 整數／浮點的字面後綴。**只影響型別，不影響值**——見檔頭。 */
const SUFFIX = /(?:[uU]|[lL]{1,2}|[fF])+$/

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:literal_number', async (node) => {
      const raw = String(node.properties.value)
      /**
       * 🔴 **數字分隔符 `'` 要先拿掉**（C++14，2026-09-16）。
       *
       * `10'0000'0007` 在競賽程式裡很常見（那是 10⁹+7，分段比較好讀）。
       * 在此之前這裡直接 `Number()`，得到 `NaN`，然後**整支程式拋錯停掉**。
       *
       * ⚠️ 它是**寫法**不是值：`1'000` 與 `1000` 是同一個數。所以剝在這裡，
       *    而 `properties.value` 留原文——產生器照樣吐回原本那個寫法。
       */
      const noSep = raw.replace(/'/g, '')
      // ⚠️ 十六進位／二進位不能剝：`0xFF` 的 `F` 是數字不是後綴。
      const bare = /^0[xXbB]/.test(noSep) ? noSep : noSep.replace(SUFFIX, '')
      /**
       * 🔴 **開頭是 `0` 的整數是八進位**（2026-09-19，`basic/3_literal_constant.cpp`）。
       *
       * `Number('0103')` 在 JavaScript 裡是 **103**，而 C++ 說 **67**。
       * 那支語料整節在教「開頭 0b 是二進位、開頭 0 是八進位、開頭 0x 是十六進位」
       * ——三種裡我們只做對了兩種，而**錯的那一種正是它在教的那一行**。
       *
       * > **一個把 `0103` 讀成 103 的工具，在一堂教八進位的課上，
       * > 教的是「這個規則不存在」。**
       *
       * ⚠️ `0` 自己不是八進位（它就是零）；`0x`／`0b` 上面已經排掉了；
       *    `08`／`09` 在 C++ 裡是**編譯錯誤**，這裡讓它走一般路徑（`Number` 給 8／9）
       *    ——那一段本來就編不過，不會有人跑到。
       */
      const num = /^0[0-7]+$/.test(bare) ? parseInt(bare, 8) : Number(bare)
      // 🔴 **判不出來就出聲**——回 `NaN` 的話錯誤會出現在離根因很遠的地方
      //（第三十三條護欄「靜默回退」在看這個）。
      if (Number.isNaN(num)) {
        throw new Error(`讀不懂這個數字字面：${JSON.stringify(raw)}`)
      }
      // ⚠️ 浮點後綴（`1.5f`）也要算成 double——判準是**剝掉後綴之後**有沒有小數點
      if (bare.includes('.') || /[eE]/.test(bare)) {
        return { type: 'double', value: num }
      }
      /**
       * 🔴 **超過 2^53 的整數字面值要保持精確**（2026-09-19）。
       *
       * `Number('9007199254740993')` 是 **9007199254740992**——少了 1，
       * 而那個 1 不會有任何人出聲。`long long` 精確到 9.2e18。
       *
       * ⚠️ 判準是**字面上的位數**，不是 `num` 的大小：`num` 已經失真了，
       *    拿它來判等於用一個壞掉的尺去量它自己。
       * ⚠️ 十六進位／二進位也要（`0x7FFFFFFFFFFFFFFF`）——所以用 `BigInt(bare)`，
       *    它認得 `0x`／`0b` 前綴。八進位那一路上面已經轉成十進位了。
       */
      if (!Number.isSafeInteger(num)) {
        try {
          const exact = /^0[0-7]+$/.test(bare) ? BigInt(parseInt(bare, 8)) : BigInt(bare)
          return { type: 'int', value: narrow(exact) }
        } catch {
          // `BigInt` 吞不下的形狀（不該發生，因為上面已經確認它是整數）——照舊
        }
      }
      return { type: 'int', value: Math.trunc(num) }
    })
}
