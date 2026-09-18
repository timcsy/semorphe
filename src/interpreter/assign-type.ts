/**
 * **一個變數的型別不會因為被指定而改變。**
 *
 * ## 🔴 它從哪來（2026-09-18，語料抓到）
 *
 * ```cpp
 * char c = 'a';  c = c + 7;  cout << c;      g++ 印 h ／ 我們印 104
 * ```
 *
 * `c + 7` 在 C++ 裡是 `int`（整數提升），而**指定回去的時候它會轉回 `char`**
 * ——那是 C++ 的規則，不是一個細節：`c` 的型別在宣告的那一行就定了。
 *
 * 而這個直譯器的指定是「把求出來的值原樣寫進那一格」，於是那一格的型別
 * 被右邊換掉了。症狀**不是報錯**：它印出一個數字，而學生看到的是
 * 「我明明宣告成 char」。
 *
 * > **一個「寫什麼就存什麼」的指定，會讓變數的型別跟著最後一次賦值走
 * > ——而那是一個動態語言的規則，不是這個語言的。**
 *
 * ## ⚠️ 只收斂純量
 *
 * 容器、結構、位置（迭代器）不在此列——它們的「型別」在這個直譯器裡
 * 帶著結構資訊（`elemType`／`keyed`／`offset`），硬轉會把那些弄丟。
 * 而 C++ 那一側，把一個容器指定給另一個容器本來就是**複製**，不是轉型。
 *
 * ## 🔴 為什麼它住在核心，不住在 `languages/cpp`
 *
 * 第一版放在 `languages/cpp/lang/runtime/`，而複合指定的執行器住在核心
 * ——於是核心 import 了語言套件，**中立性護欄當場指名它**
 *（「拔掉 C++ 之後這裡會編不過」，P9 的原文）。
 *
 * 而護欄是對的，理由不只是分層：**這一段從頭到尾沒有提到任何 C++ 的身分**。
 * 它講的是 `RuntimeValue` 的純量型別（`int`／`char`／`bool`…）與這個直譯器
 * 自己的 `char` 雙表示——那些是**核心的詞彙**。
 *
 * > **一段程式該住在哪裡，問它講的是誰的詞彙，不是問誰第一個需要它。**
 */
import type { RuntimeValue } from './types'
import type { ExecutionContext } from './executor-registry'

/** 會被收斂的純量型別——其餘原樣。 */
const SCALARS = new Set(['int', 'float', 'double', 'char', 'bool', 'string'])

/**
 * 把要寫進去的值轉成**那一格本來的型別**。
 *
 * ⚠️ 讀不到舊值（第一次寫）、或兩邊不是純量時**原樣回傳**——不猜。
 */
export function keepDeclaredType(
  before: unknown, val: RuntimeValue, ctx: ExecutionContext,
): RuntimeValue {
  const old = before as RuntimeValue | undefined | null
  if (!old || typeof old !== 'object' || !('type' in old)) return val
  if (!SCALARS.has(old.type) || !SCALARS.has(val.type)) return val
  /**
   * 🔴 **`char` 在這個直譯器裡有【兩種表示】**（2026-09-18，當場撞到）：
   *
   * ```
   * 碼位        cpp:string_at／container_iter 的格子   { type:'char', value: 104 }
   * 單字元字串  cpp:literal_char／coerceType           { type:'char', value: 'h' }
   * ```
   *
   * 所以「保住型別」不夠——**要保住那一格原本的表示法**。
   * 第一版只問型別，於是 `s[0] -= 7` 把一個碼位換成了一個字串，
   * 而寫回字串那一格的地方做 `Number('a')` ＝ NaN ⟹ 存進一個 NUL。
   *
   * > **一個值有兩種表示時，「轉成正確的型別」會在其中一種上把它弄壞
   * > ——而型別檢查不會說話，因為兩種的型別是同一個。**
   */
  if (old.type === 'char') {
    return typeof old.value === 'number'
      ? { type: 'char', value: Math.trunc(ctx.toNumber(val)) }
      : ctx.coerceType(val, 'char')
  }
  if (old.type === val.type) return val
  return ctx.coerceType(val, old.type)
}
