/**
 * `cpp:malloc` 的 **execute** 路——**配置真的儲存體**
 *
 * ## 🔴 它原本回傳一個固定字串
 *
 * ```ts
 * return { type: 'pointer', value: `heap_${type}` }   // 舊的
 * ```
 *
 * 與 `cpp:new` 同一個病：兩次 `malloc` 拿到同一個字串，而 `arr[0] = 100`
 * 之後 `arr` 根本不是陣列，於是 `TYPE_MISMATCH: array`
 * ——第三十二條護欄 18 段缺口裡的 2 段。
 *
 * ## `n * sizeof(T)` 是**位元組數**，不是元素個數
 *
 * 這是與 `new T[n]` 唯一不同的地方：`new` 的 `[n]` 直接就是個數，
 * 而 `malloc` 拿到的是位元組。所以要除以元素大小——
 * 元素型別由 `sizeof_type` 宣告（那個屬性本來就在，只是沒有人讀）。
 *
 * ⚠️ **除不盡時不猜**：`malloc(7)` 對 `int` 除不盡，那多半是使用者算錯了，
 * 而靜默無條件捨去會讓那個錯往後延到某次索引越界才現形。
 */
import type { ComponentExecutor } from '../../../interpreter/executor-registry'
import { defaultValue } from '../../../interpreter/types'
import type { RuntimeValue } from '../../../interpreter/types'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

/** 與 `cpp:sizeof` 用的是同一張表——兩邊不一致的話 `malloc` 會配錯格數。 */
const SIZES: Record<string, number> = {
  char: 1, bool: 1, short: 2, int: 4, float: 4, long: 8, double: 8, 'long long': 8,
}

/** `(int*)` → `int`。`type` 在這顆元件裡是**轉型型別**（指標），見 generate。 */
function elementType(node: { properties: Record<string, unknown> }): string {
  const declared = node.properties.sizeof_type
  if (typeof declared === 'string' && declared) return declared
  const cast = String(node.properties.type ?? 'int*')
  return cast.replace(/\s*\*+\s*$/, '').trim() || 'int'
}

export function registerExecute(register: (component: string, executor: ComponentExecutor) => void): void {
  register('cpp:malloc', async (node, ctx) => {
    const elem = elementType(node)
    const unit = SIZES[elem] ?? 4

    const sizeNode = (node.children.size ?? [])[0]
    if (!sizeNode) {
      // 沒有大小＝語義樹壞掉（`size` 是宣告過的接點）。配一格而不是丟錯，
      // 與別處的缺子節點退路同形（防禦性）。
      return { type: 'array', value: [defaultValue(elem)] }
    }

    const bytes = Number((await ctx.evaluate(sizeNode)).value)
    if (!Number.isFinite(bytes) || bytes < 0) {
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': `malloc 的大小不是非負整數` })
    }
    if (bytes % unit !== 0) {
      // 見檔頭：除不盡不猜。
      throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, {
        '%1': `malloc(${bytes}) 除不盡 sizeof(${elem})=${unit}`,
      })
    }

    const cells: RuntimeValue[] = []
    for (let i = 0; i < bytes / unit; i++) cells.push(defaultValue(elem))
    return { type: 'array', value: cells }
  })
}
