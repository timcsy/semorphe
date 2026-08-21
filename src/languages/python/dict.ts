/**
 * **字典的鍵**——Python 的鍵可以是任何不可變的值，而底層的 `Map` 只吃字串。
 *
 * ## 為什麼需要這一份
 *
 * ```python
 * squares = {n: n * n for n in [1, 2, 3]}
 * print(squares)          # 真 Python：{1: 1, 2: 4, 3: 9}
 *                         # 我們曾經：  {'1': 1, '2': 4, '3': 9}
 * ```
 *
 * 鍵一律 `String(k.value)` 之後，**「整數 1」與「字串 '1'」變成同一個鍵**，
 * 而印出來時我們只剩字串，於是每一個鍵都加上引號。
 * ⚠️ 症狀**不報錯、有輸出**——用整數當鍵在教學語料裡非常常見（計次、對照表）。
 *
 * ## 做法：查詢用字串，而**原本的值留在旁邊**
 *
 * 🔴 **不把型別編進鍵字串裡**（例如把整數 1 存成 `"1"`、字串存成 `"'1'"`）：
 * 那樣 `.keys()` 要**解析回去**才拿得到值，而這個專案付過那個學費
 * ——「**需要 parse 回結構才能用的字串，就不該是字串**」。
 *
 * 所以：`Map` 的鍵仍然是字串（查詢、`in`、寫入都不變），
 * 而**每個鍵原本的 `RuntimeValue` 存在旁邊一張表**裡。
 *
 * ⚠️ **已知的邊界**：`{1: "a", "1": "b"}` 這種同時用兩種型別當同一個字面鍵的
 * 字典，兩者仍然會撞在一起。那在教學語料裡不出現，而它寫在這裡是為了
 * 讓它是**已知的**，不是沒有人記得的巧合。
 */
import type { RuntimeValue, ObjectFields } from '../../interpreter/types'

/** 一個鍵在底層 `Map` 裡的字串。**查詢、寫入、`in` 都用這個。** */
export function dictKeyOf(v: RuntimeValue): string {
  return String(v?.value)
}

/** 一個字典連同它的「鍵原本長什麼樣」。 */
export function makeDict(entries: ObjectFields, keyValues: Map<string, RuntimeValue>): RuntimeValue {
  return { type: 'object', value: entries, structName: 'dict', keyValues }
}

/** 寫進一格，**同時記住那個鍵原本的值**。 */
export function dictSet(dict: RuntimeValue, key: RuntimeValue, value: RuntimeValue): void {
  ;(dict.value as ObjectFields).set(dictKeyOf(key), value)
  if (!dict.keyValues) dict.keyValues = new Map()
  dict.keyValues.set(dictKeyOf(key), key)
}

/**
 * 一個字典的鍵，**照原本的型別**。
 *
 * ⚠️ 沒有那張旁表時退回字串鍵——那是**顯式的退路**：
 * 類別的實例也用同一個值型別，而它們的欄位名本來就是字串。
 */
export function dictKeys(dict: RuntimeValue): RuntimeValue[] {
  const m = dict.value as ObjectFields
  return [...m.keys()].map((k) => dict.keyValues?.get(k) ?? { type: 'string', value: k })
}
