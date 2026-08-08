/**
 * cctype 的執行——字元分類。
 *
 * ## 這一份原本住在核心，而中立性護欄看不到它
 *
 * 四個概念身分寫在 `src/interpreter/interpreter.ts` 裡，形式是**裸的物件鍵**
 * （`cpp_isalpha:` 而不是 `'cpp_isalpha'`）。
 *
 * **中立性護欄只比對引號字串字面**，所以它一筆都沒數到——那條護欄的「0」
 * 因此不完整。這是「一條規範被機械化時，選了哪一維會消失在數字裡」的又一個
 * 面向：不只維度（身分 vs 語法），連**同一維度的不同書寫形式**都可能漏掉。
 *
 * ## 順帶修掉的兩個真 bug
 *
 * 兩個都是**重新產生一支過期的 `it.todo`** 時抓到的，而 todo 上寫的阻斷者
 * （「陣列初始化列表遺失」）**早就不存在了**——真正的問題是別的。
 *
 * 1. **`isdigit('a')` 回傳真。** 原本 `String(val.value).charAt(0)`——
 *    字元值以數字存放時（`'a'` → 97），那句取到的是 `'9'`。
 *    現在依 `type` 決定怎麼取字元。
 * 2. **`isupper` / `islower` 根本沒有實作**，呼叫它會說未定義函式。
 */
import type { ConceptExecutor } from '../../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../../interpreter/types'

/**
 * 從執行期值取出一個字元。
 *
 * ⚠️ **不能一律 `String(value).charAt(0)`。** 字元在這個直譯器裡可能以
 * 數字碼存放（陣列初始化列表就是這樣），那句會把 97 取成 `'9'`——
 * 於是 `isdigit('a')` 回傳真，而**程式跑完、印出東西、結果是錯的**。
 */
function charOf(v: RuntimeValue): string {
  if (v.type === 'char') {
    const s = String(v.value)
    // 已經是字元就直接用；是數字碼就轉回字元
    return s.length === 1 && !/^\d$/.test(s) ? s : String.fromCharCode(Number(v.value))
  }
  if (typeof v.value === 'number') return String.fromCharCode(v.value)
  return String(v.value).charAt(0)
}

/**
 * ⚠️ **只列有完整五路的概念。**
 *
 * 第一版順手加了 `isalnum`／`isupper`／`islower`／`isspace`／`ispunct`——
 * 而它們**沒有概念定義、沒有辨識、沒有產生器、沒有積木**。
 *
 * 那正是 P2 五路完備性禁止的：一條路的實作配上四條路的空白，等於一個使用者
 * 永遠碰不到、而孤兒實作護欄會報出來的東西。
 *
 * 要加它們的話是**五路一起加**，那是另一個功能，不是這一刀的順手。
 */
const CLASSIFIERS: Record<string, (c: string) => boolean> = {
  'cpp:isalpha': (c) => /[a-zA-Z]/.test(c),
  'cpp:isdigit': (c) => /[0-9]/.test(c),
}

const TRANSFORMERS: Record<string, (c: string) => string> = {
  'cpp:toupper': (c) => c.toUpperCase(),
  'cpp:tolower': (c) => c.toLowerCase(),
}

export function registerCctypeExecutors(
  register: (concept: string, executor: ConceptExecutor) => void,
): void {
  const arg = async (
    node: Parameters<ConceptExecutor>[0],
    ctx: Parameters<ConceptExecutor>[1],
  ): Promise<RuntimeValue | null> => {
    const v = node.children.value?.[0]
    return v ? ((await ctx.evaluate(v)) as RuntimeValue) : null
  }

  for (const [concept, fn] of Object.entries(CLASSIFIERS)) {
    register(concept, async (node, ctx) => {
      const v = await arg(node, ctx)
      if (!v) return { type: 'int', value: 0 }
      return { type: 'int', value: fn(charOf(v)) ? 1 : 0 }
    })
  }

  for (const [concept, fn] of Object.entries(TRANSFORMERS)) {
    register(concept, async (node, ctx) => {
      const v = await arg(node, ctx)
      if (!v) return { type: 'char', value: '' }
      return { type: 'char', value: fn(charOf(v)) }
    })
  }
}
