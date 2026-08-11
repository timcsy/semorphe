/**
 * C++ 語言核心中跨容器的泛用操作執行路——膠囊的第五面牆。
 *
 * 在此之前它住在 `src/interpreter/executors/containers.ts`，讓核心層認識了 7 個 C++ 專屬的概念身分。
 *
 * 見 specs/054-execute-into-capsules/
 */
import type { RuntimeValue } from '../../../../interpreter/types'
import { valueToString } from '../../../../interpreter/types'

/**
 * Map is stored as { type: 'array', value: [ [keyRV, valRV], [keyRV, valRV], ... ] }
 * where each pair is a 2-element RuntimeValue[].
 * We wrap pairs as RuntimeValue with type='array'.
 */

export function mapFind(pairs: RuntimeValue[], keyVal: RuntimeValue): number {
  const keyStr = valueToString(keyVal)
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i]
    if (pair.type === 'array' && Array.isArray(pair.value) && pair.value.length >= 1) {
      if (valueToString(pair.value[0]) === keyStr) return i
    }
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
