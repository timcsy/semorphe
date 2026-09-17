/**
 * **接收者可能帶著一個下標**——`d2[3].push_back(5)` 的 `d2[3]`。
 *
 * ## 🔴 它從哪來（2026-09-16）
 *
 * 真實的學生程式裡 `vector<int> d2[107];` 很常見（相鄰串列的慣用寫法），
 * 而組裝路徑把接收者**壓成一個字串**：`properties.obj === "d2[3]"`。
 * 於是 `scope.get("d2[3]")` 找不到那個名字，整支程式停掉。
 *
 * ⚠️ **不是把它改成一個接點**——那要動 37 個元件的宣告、積木與對照圖，
 * 血緣太廣。這裡做的是「那個字串解得開的話就解開」。
 *
 * > **一個被壓成文字的結構，解開它的地方要只有一個
 * > ——三十七份各自的字串處理，是三十七個會各自壞掉的地方。**
 *
 * ## ⚠️ 下標裡只認得數字、名字、以及它們的加減
 *
 * `d2[f(i)]` 這種解不開——而它**照原樣交給 `scope.get`**，
 * 於是錯誤訊息仍然是原本那一句（指著那個解不開的字串），不是一個假名字。
 *
 * > **一個解不開的輸入，要原樣送回去讓原本的人報錯
 * > ——自己造一個「大概是這個吧」的答案，會讓錯誤訊息指向別的地方。**
 */
import type { RuntimeValue } from './types'
import { RuntimeError, RUNTIME_ERRORS } from './errors'

interface ScopeLike {
  get(name: string): RuntimeValue
}

/** `名字[下標]` ——解不開就回 `null`。 */
function splitSubscript(text: string): { base: string; index: string } | null {
  const m = /^\s*([A-Za-z_]\w*)\s*\[([^\][]+)\]\s*$/.exec(text)
  return m ? { base: m[1], index: m[2] } : null
}

/** 下標算得出來嗎——數字、名字、加減。算不出來回 `null`。 */
function evalIndex(scope: ScopeLike, expr: string): number | null {
  let total = 0
  let sign = 1
  for (const tok of expr.split(/([+-])/)) {
    const t = tok.trim()
    if (t === '') continue
    if (t === '+') { sign = 1; continue }
    if (t === '-') { sign = -1; continue }
    if (/^\d+$/.test(t)) { total += sign * Number(t); continue }
    if (!/^[A-Za-z_]\w*$/.test(t)) return null
    let v: RuntimeValue
    try { v = scope.get(t) } catch { return null }
    if (typeof v.value !== 'number') return null
    total += sign * v.value
  }
  return total
}

/**
 * 把一個「接收者的文字」解成一個執行期的值。
 *
 * ⚠️ 平常就是 `scope.get(text)`——**只有在它是 `名字[下標]` 的時候才多做一步**，
 * 所以它不會改變任何原本走得通的路徑。
 */
export function receiverOf(scope: ScopeLike, text: string): RuntimeValue {
  const sub = splitSubscript(text)
  if (!sub) return scope.get(text)
  const base = scope.get(sub.base)
  if (!Array.isArray(base.value)) return scope.get(text)
  const i = evalIndex(scope, sub.index)
  if (i === null) {
    /**
     * 🔴 **下標算不出來時要說清楚是【下標】算不出來**（2026-09-16，模糊測試抓到的）。
     *
     * `h[i % 3].push_back(6)` 在此之前掉回 `scope.get("h[i % 3]")`，
     * 於是訊息是「未宣告的變數 `h[i % 3]`」——而 `h` **是**宣告過的。
     * 那句話把「我算不出這個下標」說成「你沒宣告這個東西」。
     *
     * > **一個降級用的錯誤訊息，會把自己的限制說成使用者的錯。**
     *
     * ⚠️ **而這裡刻意不把算式補齊**（`*`／`/`／`%`）：那會變成第二份算術語義，
     * 而真正的修法是**接收者不該被壓成文字**（見檔頭與 `history/241` 的開放項）。
     * 實測那 218 支學生程式裡這種下標**一處都沒有**，所以先說實話，不先補洞。
     */
    throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, {
      '%1': `這個接收者的下標算不出來：「${text}」（下標支援數字、名字、以及它們的加減）`,
    })
  }
  const cell = (base.value as RuntimeValue[])[i]
  if (cell === undefined) {
    throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, { '%1': String(i) })
  }
  return cell
}
