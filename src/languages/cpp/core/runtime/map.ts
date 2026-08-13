/**
 * **對應表的執行期輔助** —— 與身分無關的演算法
 *
 * ⚠️ **這一份原本有兩個逐字相同的複本**：`core/executors/containers.ts` 與
 * `std/map/executors.ts`。`container_count` 用前者、`map_assign` 用後者。
 * 理由與症狀見 `range.ts` 的檔頭——同一天、同一條護欄抓到的。
 */
import type { RuntimeValue } from '../../../../interpreter/types'
import { valueToString } from '../../../../interpreter/types'

/**
 * 對應表存成 `{ type: 'array', value: [ pair, pair, … ] }`，
 * 而**每一個 pair 就是 `cpp:pair_make` 產出的那種物件**
 * （`{ type: 'object', structName: 'pair', value: Map{first, second} }`）。
 *
 * ## ⚠️ 這裡原本是二元陣列，而那是**同一個東西的第二種表示**
 *
 * `make_pair(3,4)` 產出物件、`m["a"]=1` 產出二元陣列——兩者都是「一對值」。
 * 於是 `for (auto& kv : m) cout << kv.first` **執行不了**：`kv` 是陣列，
 * 而讀 `.first` 走的是結構欄位那條路，訊息是「kv（不是一個結構）」。
 *
 * > **同一個概念有兩種執行期表示，症狀不會出現在建立它的那一邊，
 * > 而是出現在第一個同時看到兩邊的消費者身上。**
 *
 * 統一成物件而不是統一成陣列，理由是**消費者已經站在物件那一邊**：
 * `.first`／`.second` 是結構欄位存取，而那條路只認物件。
 */

/** 建一個對應表項目——與 `cpp:pair_make` 產出的形狀相同。 */
export function makePair(key: RuntimeValue, value: RuntimeValue): RuntimeValue {
  return {
    type: 'object',
    value: new Map<string, RuntimeValue>([['first', key], ['second', value]]),
    structName: 'pair',
  }
}

/** 讀一個對應表項目的鍵／值。不是 pair 形狀就回 `undefined`——不猜。 */
export function pairParts(pair: RuntimeValue): { key: RuntimeValue; value: RuntimeValue } | undefined {
  if (pair.type !== 'object' || !(pair.value instanceof Map)) return undefined
  const key = pair.value.get('first')
  const value = pair.value.get('second')
  return key && value ? { key, value } : undefined
}

/** 設一個對應表項目的值。 */
export function setPairValue(pair: RuntimeValue, value: RuntimeValue): void {
  if (pair.type === 'object' && pair.value instanceof Map) pair.value.set('second', value)
}

export function mapFind(pairs: RuntimeValue[], keyVal: RuntimeValue): number {
  const keyStr = valueToString(keyVal)
  for (let i = 0; i < pairs.length; i++) {
    const parts = pairParts(pairs[i])
    if (parts && valueToString(parts.key) === keyStr) return i
  }
  return -1
}

/**
 * ⚠️ **這個模組不再註冊任何執行器**——它的元件全部搬進膠囊了。
 *
 * 檔案留著是因為裡面還有**共用的演算法**（見上面的匯出），
 * 而那些不屬於任何一顆元件。
 *
 * > **模組是搬家的中途站，不是終點——而中途站的最後一塊石頭是它共用的東西。**
 */

