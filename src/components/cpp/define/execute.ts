/**
 * `cpp:define` 的 **execute** 路
 *
 * ## ⚠️ 這不是巨集展開——那條路是墓碑，而它仍然成立
 *
 * `history/014-墓碑目錄.md:23` 否決了「模擬 C preprocessor 來解決巨集」，
 * 理由逐字：「重新實現 C preprocessor 的正確性成本極高，而收益只在 S3-S5……
 * **S0-S2 的教學場景根本不需要（學生程式碼不會用框架巨集）**」。
 *
 * 那個判斷**對函式巨集仍然成立**（`#define SQR(x) ((x)*(x))` 要文字替換，
 * 語義層不該去模擬它）。而**它的理由推得太遠了一格**：
 *
 * > 學生**不用框架巨集**是真的。而學生**會用 `#define MAX 100` 定義常數**
 * > ——那是 C 風格教學裡最常見的一行。
 *
 * 實測：第三十二條護欄的 18 段缺口裡有 **2 段**倒在這裡
 * （`#define LIMIT 100` 之後用 `LIMIT` → `UNDECLARED_VAR`）。
 *
 * ## 所以做的是另一件事：**具名常數的宣告**
 *
 * `#define MAX_SIZE 100` 在語義上就是一個具名常數——C++ 自己的建議也是
 * 「用 `const` 取代 `#define`」。把它綁進 scope **不需要任何前處理器**，
 * 與墓碑「不模擬文字替換」不衝突。
 *
 * ## ⚠️ 值不是字面常數時：不猜，讓它繼續出聲
 *
 * `#define SQR(x) ((x)*(x))`、`#define MIN(a,b) …` 這些**刻意不處理**。
 * 那時 `SQR` 仍然是未宣告，`UNDECLARED_VAR` 照樣丟出來——
 * **一個沒被支援的東西要繼續報錯，不能因為「我們處理了一半」就變安靜。**
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { defined } from '../../../languages/cpp/lang/executors/preprocessor'
import { setAlias } from '../../../interpreter/aliases'
import { unescapeC } from '../../../core/registry/transform-registry'

/**
 * 巨集的值是不是一個**字面常數**。不是就回 `null`——呼叫端據此決定不綁。
 *
 * ⚠️ 只認字面量，不認運算式（`#define AREA (W*H)`）。認了就等於在語義層
 * 做求值，而那條線一跨過去就是在重建前處理器。
 *
 * ## 🔴 2026-09-19：補上**漏掉的那幾種字面量**（不是跨過上面那條線）
 *
 * 語料量到三種寫得出來而這裡認不得的：
 *
 * ```
 * #define z '0'        字元字面值      w/APCS/j607_2t.cpp（`s[i] - z`）
 * #define z -'0'       帶正負號的同上
 * #define MAXN 1e7     科學記號        語料裡 1e7／1e9 很常見
 * #define M 0x3f3f3f3f 十六進位
 * #define M 1000000007LL 帶字尾的整數
 * ```
 *
 * ⚠️ **它們全部都是【字面量】**——上面那條線排除的是「運算式」
 *（`(W*H)`、`SQR(x)`），而這幾個是這支函式自己沒寫完。
 *
 * > **一條「只認 X」的規則，與「只認我當時想到的那幾種 X」長得一模一樣
 * > ——直到有人寫出第五種 X。**
 *
 * ⚠️ 正負號那一格**本來就在**（`[+-]?\d+`），所以 `-'0'` 走的是同一條路，
 *    不是新開的一條。
 */
function literalValue(raw: string): RuntimeValue | null {
  const s = raw.trim()
  if (!s) return null
  /**
   * 🔴 **帶正負號**——原本只有十進位整數與小數有這一格，而字元與十六進位沒有。
   * 拆出來一次，下面每一種都適用。
   */
  const m = /^([+-]?)\s*(.*)$/.exec(s)
  const sign = m?.[1] === '-' ? -1 : 1
  const body = m?.[2] ?? s
  /** ⚠️ 字尾（`LL`／`ULL`／`u`／`f`）是**型別的事**，不是值的事——這個直譯器不分寬度。 */
  const int = /^(0[xX][0-9a-fA-F]+|0[bB][01]+|\d+)(u|U|l|L|ll|LL|ul|UL|ull|ULL)?$/.exec(body)
  if (int) return { type: 'int', value: sign * Number(int[1]) }
  const dbl = /^(\d+\.\d*|\.\d+|\d+(\.\d*)?[eE][+-]?\d+|\d*\.\d+[eE][+-]?\d+)(f|F|l|L)?$/.exec(body)
  if (dbl) return { type: 'double', value: sign * Number(dbl[1]) }
  /**
   * 🔴 **字元字面值以【數字碼】存放**——這個直譯器裡字元有兩種存法，
   * 而 `cpp:literal_char` 存的是碼位。這裡要與它一致，否則
   * `#define z '0'` 之後 `s[i] - z` 會拿一個字串去減。
   * ⚠️ 解跳脫用**既有的** `unescapeC`（`'\n'` 是兩個字元）——不另寫一份。
   */
  const ch = /^'(([^'\\]|\\.)*)'$/.exec(body)
  if (ch) {
    const decoded = unescapeC(ch[1])
    if (decoded.length > 0) return { type: 'char', value: sign * decoded.charCodeAt(0) }
  }
  if (/^"([^"\\]|\\.)*"$/.test(s)) {
    try {
      return { type: 'string', value: JSON.parse(s) as string }
    } catch {
      return null
    }
  }
  if (/^true$|^false$/.test(s)) return { type: 'bool', value: s === 'true' }
  return null
}

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:define', async (node, ctx) => {
    const name = String(node.properties.name ?? '')
    if (!name) return
    // `#ifdef` / `#ifndef` 讀這個集合——與下面的常數綁定是兩件獨立的事
    defined.add(name)

    const raw = String(node.properties.value ?? '').trim()
    const value = literalValue(raw)
    // ⚠️ 同名重複 `#define` 時 `declare` 會丟錯，而那是對的：
    // 兩個不同的值綁到同一個名字，靜默取其一會讓後面的算式莫名其妙。
    if (value) { ctx.scope.declare(name, value); return }

    /**
     * 🔴 **取小名那一族**（2026-09-16）——218 支學生程式裡 19 支撞在這裡：
     *
     *     #define x first        #define pb push_back
     *     #define y second       #define pii pair<int,int>
     *
     * 在此之前只有字面值那條路，於是 `pr.x` 拋 UNDECLARED_VAR。
     *
     * ⚠️ **只收「一個名字」或「一個型別」**：帶參數的 `#define rep(i,n) …`
     *    是一段程式不是一個名字，它不進這張表（而它會繼續報錯，那是誠實的）。
     * ⚠️ 也**不做替換**——見 `interpreter/aliases.ts` 的檔頭：
     *    替換會回頭改寫使用者的程式碼。
     */
    /**
     * 🔴 **多個字的型別名也算**（2026-09-19）——`#define ll long long` 在語料裡 **41 處**，
     * 而這條正則原本要求「一個字」，於是那 41 處**一個都沒有進表**。
     *
     * 症狀不是報錯：`ll n = 2e9;` 的 `coerceType(…, 'll')` 查不到本名，
     * 於是那個變數**一直是一個 double**，印成 `2e+09`、位移被截成 32 位元。
     *
     * > **一個「只認一個字」的規則，對語料裡最常見的那個寫法剛好無效
     * > ——而它不會出聲，因為「查不到就讓開」本來就是它的設計。**
     */
    if (/^(unsigned |signed |const |long |short )*[A-Za-z_]\w*(\s*<[^>]*>)?(\s*\*)*$/.test(raw)) {
      setAlias(name, raw)
    }
  })
}
