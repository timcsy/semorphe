/**
 * 「一個值印出來長什麼樣」——**Python 的規則，一份**。
 *
 * ## 為什麼要獨立一個模組
 *
 * 這條規則有**三個消費者**：`print(x)`、`str(x)`、以及格式化文字的每一格。
 * 而 2026-08-21 它一度有**兩份**：輸出元件裡的 `fmt` 懂 `True`／`None`／`3.0`，
 * 內建函式表裡的 `pyStr` 懂串列與字典——於是 `print([1, 2])` 印出
 * **`[object Object],[object Object]`**。
 *
 * > **兩份真相不會同時錯，它們會【各自】對一半——而那時兩邊的測試都是綠的。**
 *
 * ## ⚠️ 每一條都與 C++ 不同，而差別會被使用者一眼看到
 *
 * ```
 * True / False    首字母大寫          C++ 印 1 / 0
 * None            而不是空字串
 * 3.0             小數保留小數點       C++ 的 3.0 印成 3
 * [1, 2]          串列有中括號與逗號
 * {'a': 1}        字典的鍵用單引號     ← Python 自己就是這樣印的
 * (0, 9)          tuple 是圓括號       ← `enumerate`／`zip`／`d.items()` 產的是這個
 * ```
 *
 * ## 🔴 而**容器裡面的字串有引號，裸的字串沒有**
 *
 * ```
 * print("hi")        →  hi          （str）
 * print(["hi"])      →  ['hi']      （裡面用 repr）
 * ```
 *
 * 那是 Python 的 `str()` 與 `repr()` 之分，而它**看得見**：
 * 一個學生印出串列時看到 `[a, b]` 會以為那是兩個變數名。
 */
import type { RuntimeValue, ObjectFields } from '../../interpreter/types'

export function pythonDisplay(v: RuntimeValue, insideContainer = false): string {
  // 容器裡面的字串用 repr —— 見檔頭那一段
  if (v.type === 'string' && insideContainer) return `'${String(v.value).replace(/'/g, "\\'")}'`
  if (v.type === 'bool') return v.value ? 'True' : 'False'
  if (v.type === 'void' || v.value === null) return 'None'
  if (v.type === 'double') {
    const n = Number(v.value)
    // `3.5` → `3.5`；`3.0` → `3.0`（Python 不會把它印成 `3`）
    return Number.isInteger(n) ? `${n}.0` : String(n)
  }
  if (v.type === 'array') {
    const xs = (v.value as RuntimeValue[]).map((x) => pythonDisplay(x, true))
    // ⚠️ 一格的 tuple 印成 `(1,)`——那個逗號是 Python 用來與「加括號的運算式」分辨的
    if (v.seqKind === 'tuple') return xs.length === 1 ? `(${xs[0]},)` : `(${xs.join(', ')})`
    return `[${xs.join(', ')}]`
  }
  if (v.type === 'object') {
    const e = [...(v.value as ObjectFields).entries()].map(([k, x]) => `'${k}': ${pythonDisplay(x, true)}`)
    return `{${e.join(', ')}}`
  }
  return String(v.value)
}
