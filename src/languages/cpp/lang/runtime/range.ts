/**
 * **範圍演算法的執行期輔助** —— 與身分無關的演算法
 *
 * ⚠️ **這一份原本有兩個逐字相同的複本**：`std/algorithm/executors.ts` 與
 * `std/numeric/executors.ts`。不同的膠囊各 import 一份
 * （`range_reverse` 用前者、`range_sum_partial` 用後者）。
 *
 * > **兩份真相會漂移**——而它們在 F 之前看不出來：
 * > 那時它們是各自模組的內部實作，只有自己的註冊函式在用。
 * > 膠囊化把它們變成**跨膠囊的 import**，「同一個東西有兩個進入點」才現形。
 *
 * 第三十八條護欄（共用檔的殼與重複）第一次跑就抓到這一組。
 */
import { RuntimeError, RUNTIME_ERRORS } from '../../../../interpreter/errors'


/**
 * 把 `begin`／`end` 這種**字串**屬性解析回「哪個陣列、從哪到哪」。
 *
 * ⚠️ **技術債**：範圍本來就該是結構化的（`{ array, from, to }`），存成字串
 * 之後每個消費者都要自己 parse。專案教訓寫過這件事——「需要 parse 回結構
 * 才能用的字串，就不該是字串」。這裡先解析，型別結構化另外排。
 *
 * 支援 `a`、`a+3`、`a.begin()`、`a.end()`、`v.begin()+2`。
 *
 * **解析不了時擲錯，不回傳「沒事」**——原本的實作是空操作，於是
 * `sort(a, a+3)` 靜靜地什麼都不做，學生拿到未排序的陣列而毫無提示。
 */
export function resolveRange(
  ctx: { scope: { get(n: string): { type: string; value: unknown } | undefined } },
  begin: string,
  end: string,
): { arr: unknown[]; from: number; to: number; name: string } {
  /**
   * 偏移那一段——**數字、變數、以及它們的加減**。
   *
   * 🔴 **在此之前這裡只收數字字面值**（`(?:\+\s*(\d+))?`，2026-09-16 修）。
   *    於是 `sort(h, h+N)` 這個競賽裡最常見的寫法**整支程式拋錯停掉**
   *    ——而 `sort(h, h+3)` 是好的。實測 218 支學生程式裡有 8 支撞到。
   *
   * > **一個只收字面值的解析器，在「那個數字是算出來的」時候不會降級，會停擺
   * > ——而真實的程式幾乎都把它算出來。**
   *
   * ⚠️ 只做加減：`h+n*2` 這種留給它報錯，不要自己發明一個小算式語言
   *    （那會變成第二份運算語義，而這個 repo 為那件事付過帳）。
   */
  const offsetOf = (expr: string): number => {
    let total = 0
    let sign = 1
    for (const tok of expr.split(/([+-])/)) {
      const t = tok.trim()
      if (t === '') continue
      if (t === '+') { sign = 1; continue }
      if (t === '-') { sign = -1; continue }
      if (/^\d+$/.test(t)) { total += sign * parseInt(t, 10); continue }
      const v = ctx.scope.get(t)
      if (!v || typeof v.value !== 'number') {
        throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': `範圍的偏移看不懂：「${expr}」` })
      }
      total += sign * v.value
    }
    return total
  }
  const parse = (s: string): { name: string; offset: number; atEnd: boolean } => {
    const t = s.trim()
    const m = /^([A-Za-z_]\w*)\s*(?:\.\s*(begin|end)\s*\(\s*\))?\s*(?:\+\s*(.+))?$/.exec(t)
    if (!m) throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': `無法解析範圍「${s}」` })
    return { name: m[1], offset: m[3] ? offsetOf(m[3]) : 0, atEnd: m[2] === 'end' }
  }
  const b = parse(begin)
  const e = parse(end)
  if (b.name !== e.name) {
    throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': `範圍跨越兩個容器：${b.name} 與 ${e.name}` })
  }
  const v = ctx.scope.get(b.name)
  if (!v || v.type !== 'array' || !Array.isArray(v.value)) {
    throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': `${b.name} 不是陣列` })
  }
  const arr = v.value as unknown[]
  return { arr, from: b.offset, to: e.atEnd ? arr.length : e.offset, name: b.name }
}

export const numOf = (x: unknown): number => Number((x as { value?: unknown })?.value ?? x) || 0



