/**
 * `childrenAsField`：把一個接點的子節點序列化進**一個文字欄位**，並解析回來
 *
 * ## 為什麼有這個機制
 *
 * 六顆函式族元件（`lambda`／`constructor`／`method_virtual`／
 * `method_virtual_pure`／`method_override`／`template_function`）宣告了
 * `params` 接點，而它們的積木形態只有一個文字欄位 `PARAMS`
 * ——使用者今天就在那裡打 `int a, int b`。
 *
 * 在此之前 render 沒把子節點寫進那個欄位、extract 沒讀回來，於是
 * **走一次投影參數就靜默消失**（`[](int a, int b)` → `[]()`），
 * 而產出仍是合法的 C++，所以沒有任何訊號。
 *
 * ## ⚠️ 這是一個取捨，而它有退出條件
 *
 * 專案有一條教訓：「**需要 parse 回結構才能用的字串，就不該是字串**」。
 * 這裡的處置是：**字串只存在於形態層，語義層永遠是結構化的 `param_decl`**。
 *
 * 三個訊號，**任一個出現就該升級成結構化插槽**（像 `cpp_func_def` 那樣
 * 每個參數一組下拉＋輸入框），不要等三個都到：
 *
 * 1. 使用者在參數欄位裡打錯字造成的缺陷**出現第二次**
 * 2. 需要對參數做**逐項操作**（重排、單獨刪一個、型別下拉）
 * 3. 型別含分隔符的情形從「測試裡的邊界案例」變成**課程裡真的會教的東西**
 *
 * ## 拆錯的症狀特別壞
 *
 * 用字串承載一串結構化的東西，分隔符就是風險。而拆錯不是「少一個」那種
 * 一眼看得出來的——是**參數數量變多，而每一個都是垃圾**。
 * 所以下面的分割是**深度感知**的，而且它有專門的邊界測試。
 */
import { createNode } from '../semantic-tree'
import type { SemanticNode } from '../types'

/** 一個接點 ↔ 一個文字欄位的宣告。 */
export interface ChildrenAsField {
  /** Blockly 欄位名，例如 `PARAMS` */
  field: string
  /** 語義接點名，例如 `params` */
  childSlot: string
  /** 子節點的概念身分，例如 `param_decl` */
  childComponent: string
  /**
   * 每個子節點怎麼寫成文字：屬性名的順序。
   *
   * `['type', 'name']` → `int a`。**最後一個是「吃掉剩下全部空白分隔詞」的那個**
   * ——解析時 `long long n` 的型別要是 `long long` 而不是 `long`。
   */
  parts: string[]
  /** 子節點之間的分隔，預設 `, ` */
  itemSeparator?: string
}

const defaultItemSep = ', '

/**
 * 深度感知的分割：`<>`／`()`／`[]` 裡面的分隔符不算數。
 *
 * ```
 * map<int,int> m, int k
 *         ↑ 深度 1，不切   ↑ 深度 0，切
 * ```
 *
 * ⚠️ **括號不平衡時不得吞字**——使用者打到一半就是那個樣子。
 * 這種情形下剩下的全部當成最後一段，寧可拆不開也不要弄丟。
 */
export function splitTopLevel(text: string, sep: string): string[] {
  const out: string[] = []
  let depth = 0
  let current2 = ''
  for (const ch of text) {
    if (ch === '<' || ch === '(' || ch === '[') depth++
    else if (ch === '>' || ch === ')' || ch === ']') depth = Math.max(0, depth - 1)
    if (ch === sep && depth === 0) {
      out.push(current2)
      current2 = ''
      continue
    }
    current2 += ch
  }
  out.push(current2)
  return out.map((s) => s.trim()).filter((s) => s.length > 0)
}

/**
 * 子節點 → 文字。
 *
 * @returns 零個子節點時回傳 `null`——**不是空字串**。
 *   `null` 代表「不要寫這個欄位」，空字串代表「寫一個空欄位」，
 *   兩者在來回比對上是不同的東西。
 */
export function serializeChildren(children: readonly SemanticNode[], spec: ChildrenAsField): string | null {
  if (!children.length) return null
  return children
    .map((c) => spec.parts.map((p) => String(c.properties[p] ?? '')).filter((s) => s.length > 0).join(' '))
    .join(spec.itemSeparator ?? defaultItemSep)
}

/**
 * 文字 → 子節點。
 *
 * **最後一個空白分隔的詞對應 `parts` 的最後一個，其餘全部歸前一個。**
 * 這是為了讓 `long long n` 的型別是 `long long`——`split(' ')` 取前兩個會錯。
 *
 * ⚠️ **只有一個詞時不憑空補**：`void f(int)` 的 `int` 沒有名字，
 * 那就讓名字是空字串，而不是猜一個 `p0`。判不出來的留原樣，
 * 讓來回轉換抓到——猜出來的東西會安靜地變成使用者沒寫過的程式。
 */
export function parseToChildren(text: string, spec: ChildrenAsField): SemanticNode[] {
  const items = splitTopLevel(text ?? '', (spec.itemSeparator ?? defaultItemSep).trim() || ',')
  return items.map((item) => {
    const words = item.split(/\s+/).filter(Boolean)
    const props: Record<string, string> = {}
    const n = spec.parts.length
    if (n === 1) {
      props[spec.parts[0]] = item
    } else if (words.length >= n) {
      // 最後 n-1 個詞各對一個 part，剩下的全部給第一個。
      const tail = words.slice(words.length - (n - 1))
      props[spec.parts[0]] = words.slice(0, words.length - (n - 1)).join(' ')
      tail.forEach((w, i) => { props[spec.parts[i + 1]] = w })
    } else {
      // 詞不夠——**不補**。第一個 part 拿到全部，其餘空著。
      props[spec.parts[0]] = item
      for (let i = 1; i < n; i++) props[spec.parts[i]] = ''
    }
    return createNode(spec.childComponent, props)
  })
}
