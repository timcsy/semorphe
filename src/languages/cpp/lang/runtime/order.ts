/**
 * **排序的執行語義** —— 與身分無關的演算法
 *
 * 兩件事住在這裡，因為 `sort`／`stable_sort`／未來的 `nth_element` 共用它們：
 *
 * ① **預設的「小於」**——C++ 的 `operator<`，而它對 `pair` 是**字典序**
 * ② **非同步的排序**——比較器是使用者的程式碼，跑它要 `await`
 *
 * ## ⚠️ 為什麼不能用 `Array.prototype.sort`
 *
 * 比較器可能是一段 C++ 程式（lambda 或具名函式），跑它必須 `await`
 * ——而 `sort` 的 comparator 不接受 Promise。回傳 Promise 的話它會被
 * 當成 truthy 物件，**排序結果變成輸入順序的某個排列，而且看起來很正常**。
 */
import type { RuntimeValue } from '../../../../interpreter/types'

/** 一個值在排序裡的數值——`numOf` 的同義，放這裡避免與範圍解析耦合 */
function num(v: RuntimeValue): number {
  return typeof v.value === 'number' ? v.value : Number(v.value) || 0
}

/**
 * C++ 的預設 `operator<`。
 *
 * ⚠️ **`pair` 是字典序**：先比 `first`，相等才比 `second`。
 * 少了這一條，`vector<pair<int,int>>` 排序會走數值路徑，
 * 而 `Number(物件)` 是 `NaN`——**每次比較都是 false，於是順序原封不動**，
 * 那看起來像「本來就排好了」。
 */
export function defaultLess(a: RuntimeValue, b: RuntimeValue): boolean {
  if (a.type === 'object' && b.type === 'object' && a.value instanceof Map && b.value instanceof Map) {
    const af = a.value.get('first')
    const bf = b.value.get('first')
    if (af && bf) {
      if (defaultLess(af, bf)) return true
      if (defaultLess(bf, af)) return false
    }
    const as = a.value.get('second')
    const bs = b.value.get('second')
    return as && bs ? defaultLess(as, bs) : false
  }
  if (a.type === 'string' || b.type === 'string') return String(a.value) < String(b.value)
  return num(a) < num(b)
}

/**
 * **兩個值誰在前面——而使用者自己的 `operator<` 優先。**
 *
 * 🔴 它從哪來（2026-09-18，資訊隔離的盲測）：`defaultLess` 認得一對值
 * （`first`／`second`），而**不認得使用者自己定義的結構**。於是
 *
 * ```cpp
 * struct T { int k; bool operator<(const T& o) const { return k < o.k; } };
 * vector<T> v; sort(v.begin(), v.end());        我們：完全沒排序
 * set<T> s; s.insert(T(3)); s.insert(T(3));     我們：留了兩個
 * ```
 *
 * 三件事**全部是靜默的**：程式跑完、印出東西、而順序與數量都不對。
 *
 * ⚠️ **機制早就齊了**——`cpp:compare` 與 `cpp:arithmetic` 都會問
 * `ctx.structs.method(name, 'operator…')`。缺的只是**排序這一路去問**。
 * > **一個機制的消費者少一個，那個機制就對那條路徑不存在。**
 *
 * 沒有多載時落回 `defaultLess`（pair 與純量），**不猜**。
 */
export async function lessWithOverload(
  a: RuntimeValue,
  b: RuntimeValue,
  ctx: import('../../../../interpreter/executor-registry').ExecutionContext,
): Promise<boolean> {
  if (a.type === 'object' && b.type === 'object') {
    const m = ctx.structs.method(a.structName ?? '', 'operator<')
    if (m) {
      const r = await ctx.structs.invokeWith(a, m, [b])
      if (r !== undefined) return ctx.toBool(r)
    }
  }
  return defaultLess(a, b)
}

/**
 * **兩個值在有序容器裡算不算同一個。**
 *
 * 🔴 C++ 的判準是 `!(a<b) && !(b<a)`——**不是 `==`**。
 * `set` 沒有用到 `operator==`，而一個只比 `.value` 的實作對物件永遠回 false
 * （兩個 Map 不是同一個參考），於是重複的結構全部留了下來。
 */
export async function equivalentInOrder(
  a: RuntimeValue,
  b: RuntimeValue,
  ctx: import('../../../../interpreter/executor-registry').ExecutionContext,
): Promise<boolean> {
  return !(await lessWithOverload(a, b, ctx)) && !(await lessWithOverload(b, a, ctx))
}

/**
 * 穩定的合併排序，比較函式可以是非同步的。
 *
 * 穩定性不是額外要求：C++ 的 `sort` 不保證穩定，**而不穩定的實作會讓
 * 同一段程式在我們這裡與參照編譯器上印出不同的順序**，那筆差異查起來很貴
 * 而它不是缺陷。選穩定的那一邊，兩邊就對得起來。
 */
export async function asyncSort(
  cells: RuntimeValue[],
  less: (a: RuntimeValue, b: RuntimeValue) => Promise<boolean>,
): Promise<RuntimeValue[]> {
  if (cells.length <= 1) return cells
  const mid = cells.length >> 1
  const left = await asyncSort(cells.slice(0, mid), less)
  const right = await asyncSort(cells.slice(mid), less)
  const out: RuntimeValue[] = []
  let i = 0
  let j = 0
  while (i < left.length && j < right.length) {
    // **`less(right, left)` 而不是 `less(left, right)`**——相等時取左邊，那就是穩定
    if (await less(right[j], left[i])) out.push(right[j++])
    else out.push(left[i++])
  }
  while (i < left.length) out.push(left[i++])
  while (j < right.length) out.push(right[j++])
  return out
}
