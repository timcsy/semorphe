/**
 * **身分的階層，與實例的路徑——它們都用 `.`，而它們是兩種東西。**
 *
 * ```
 * 身分階層   python:numpy.linalg.solve    「這是【哪一種】東西」——型別側
 * 實例路徑   car.wheelFL.speed            「這是【哪一個】東西」——實例側
 * ```
 *
 * ## 🔴 為什麼現在就要解這個撞號
 *
 * 今天不撞：帶 `.` 的身分**0 顆**，而實例路徑那種東西**還不存在**。
 *
 * 而 vision 逐字：**「①（路徑語法）排第一是因為它是唯一一個三個域都會用到、
 * 而且錯了要全改的東西」**——等到兩邊都有東西之後才解，就要改三個域。
 *
 * ⚠️ 而規則**早就定好了**（`concepts/元件.md` §`name` 的階層，2026-08-13
 * 三輪討論）。那一節自己標著「**狀態：規則已定，尚未實作**」
 * ——這一支就是那個「實作」，而它是一支判別器不是一個機制。
 *
 * > **一條規範沒有機械化的檢查，它本身就是殼——而殼看起來像完成。**
 * > （`concepts/執行機構.md`）
 *
 * ## ⚠️ 這裡不得知道任何語言的事
 *
 * 這個檔住在 `src/core/`，而中立性護欄的 `NEUTRAL_DIRS` 第一項就是它。
 * 🔴 而那**正是當初選 `.` 而不是 `/` 的決定性理由**（`concepts/元件.md` 逐字）：
 *
 * > 選 `.` 而不是 `/` 的決定性理由是核心純淨性……
 * > **所以分隔符不能跟語言走**（那需要核心知道這顆是哪個語言的）。
 */

/**
 * 一個字串可能是什麼。
 *
 * 🔴 **三種，不是兩種。** 一個是非會逼呼叫端在兩個都不對的答案裡挑一個
 * ——而「兩者都可以解讀」正是這一支要抓的東西。
 *
 * > **一個回答「是」或「否」的判別器，在遇到「兩者都可以」的時候
 * > 必須說出第三個答案——否則它會把一個未解的衝突報成一個已解的答案。**
 */
export type PathKind = 'identity' | 'instance' | 'ambiguous' | 'invalid'

export interface PathVerdict {
  kind: PathKind
  /** 為什麼——⚠️ `ambiguous` 與 `invalid` **必須**說得出來，否則那個紅沒有用。 */
  why?: string
}

/** 一段名字裡准出現的字。⚠️ 刻意窄：拿不準的一律判 `invalid`，不猜。 */
const SEGMENT = /^[A-Za-z_][A-Za-z0-9_]*$/
/** 擁有者那一段——身分的前綴。第三方是 `@someone`。 */
const OWNER = /^@?[A-Za-z_][A-Za-z0-9_-]*$/

/**
 * **這個字串是身分階層，還是實例路徑？**
 *
 * ## 判準：擁有者那一段
 *
 * ```
 * 有冒號    python:numpy.linalg.solve   → 身分（擁有者是 python）
 * 沒冒號    car.wheelFL.speed           → 🔴 【歧義】——見下
 * ```
 *
 * ## 🔴 為什麼「沒冒號而帶 `.`」是歧義，不是實例路徑
 *
 * `numpy.linalg.solve` 少了 `python:` 就與 `car.wheelFL` 逐字同形。
 * 而它**兩種都讀得通**：一個少寫了擁有者的身分，或一條實例路徑。
 *
 * ⚠️ 判成「實例路徑」是**猜**——而猜錯的那一天，兩個域各自建了一套解讀。
 *
 * 🟢 而它有一個誠實的出路：**實例路徑要標記自己**（未來由分子那一刀決定
 * 怎麼標——前綴、包裝型別、或一個顯式的建構子）。在那之前，
 * 一個裸的帶點字串**就是分不出來**，而說出來比猜好。
 */
export function classifyPath(s: string): PathVerdict {
  if (s.length === 0) return { kind: 'invalid', why: '空字串' }

  const colon = s.indexOf(':')
  if (colon >= 0) {
    const owner = s.slice(0, colon)
    const name = s.slice(colon + 1)
    if (!OWNER.test(owner)) {
      return { kind: 'invalid', why: `冒號前面不是一個合法的擁有者：${JSON.stringify(owner)}` }
    }
    if (name.length === 0) return { kind: 'invalid', why: '冒號後面是空的' }
    // ⚠️ 第二個冒號 → 那是程式碼裡的字面（`string::npos`），不是身分
    if (name.includes(':')) {
      return { kind: 'invalid', why: `名字裡還有冒號——那多半是程式碼的字面（如 string::npos），不是身分` }
    }
    for (const seg of name.split('.')) {
      if (!SEGMENT.test(seg)) {
        return { kind: 'invalid', why: `階層裡有一段不合法：${JSON.stringify(seg)}` }
      }
    }
    return { kind: 'identity' }
  }

  // 沒有冒號
  for (const seg of s.split('.')) {
    if (!SEGMENT.test(seg)) return { kind: 'invalid', why: `有一段不合法：${JSON.stringify(seg)}` }
  }
  if (!s.includes('.')) {
    return {
      kind: 'invalid',
      why: '一個沒有冒號也沒有點的字串——它既不是身分（缺擁有者）也不是路徑（只有一段）',
    }
  }
  // 🔴 這裡就是那個撞號
  return {
    kind: 'ambiguous',
    why: `「${s}」沒有擁有者那一段，於是它【兩種都讀得通】：`
      + '一個少寫了擁有者的身分階層（`<擁有者>:' + s + '`），'
      + '或一條實例路徑。⚠️ 判成其中一種是【猜】——'
      + '而猜錯的那一天，兩個域會各自建一套解讀。',
  }
}

/**
 * 身分 → 目錄。`python:numpy.linalg.solve` → `python/numpy/linalg/solve`
 *
 * ⚠️ **`.` 與 `:` 都變成 `/`**——目錄是**投影**，而投影可以壓平；
 * 身分那一側的兩種分隔符各有意義，目錄那一側沒有。
 */
export function identityToDir(id: string): string {
  const v = classifyPath(id)
  if (v.kind !== 'identity') {
    throw new Error(`不是一個身分（${v.kind}）：${id}${v.why ? `——${v.why}` : ''}`)
  }
  return id.replace(':', '/').replace(/\./g, '/')
}

/**
 * 身分 → 積木型別名。`python:numpy.linalg.solve` → `python_numpy_linalg_solve`
 *
 * 🔴 **`_` 不能當身分的分隔符，但可以當投影的**——`concepts/元件.md` 逐字：
 * 「`numpy_linalg_solve` 是 `numpy.linalg.solve` 還是 `numpy.linalg_solve`？
 * **`_` 今天已經是詞之間的分隔**」。
 *
 * 🟢 而**投影方向不需要可逆**：從身分算得出型別名就夠了，
 * 反過來由登錄表查（那是一張真的表，不是一次字串還原）。
 */
export function identityToBlockType(id: string): string {
  const v = classifyPath(id)
  if (v.kind !== 'identity') {
    throw new Error(`不是一個身分（${v.kind}）：${id}${v.why ? `——${v.why}` : ''}`)
  }
  return id.replace(':', '_').replace(/\./g, '_')
}
