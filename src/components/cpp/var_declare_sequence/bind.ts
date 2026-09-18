/**
 * **把一個值按位置拆開，分給幾個名字**——宣告與範圍 for 共用的那一份。
 *
 * ## 為什麼是共用的一份
 *
 * ```cpp
 * auto [pt, d] = q.front();        ← 這顆元件
 * for (auto [w, to] : ar[P])       ← 範圍 for 那顆
 * ```
 *
 * 兩者**拆的方式一模一樣**，差別只在「拆的是誰」。寫兩份會漂移，
 * 而漂移的症狀是「宣告式拆得開而迴圈裡拆不開」——同一支程式裡兩種行為。
 *
 * ## 🔴 格數對不上就丟錯，不補預設值
 *
 * `auto [a,b,c] = 一對` 在 C++ 是**編譯錯誤**——我們跑得到它，所以要出聲。
 * 補一個 0 或忽略多出來的，會讓一個真的錯誤看起來像跑成功了（第三十三條）。
 */
import type { ExecutionContext } from '../../../interpreter/executor-registry'
import type { RuntimeValue } from '../../../interpreter/types'
import { aggregateShapeOf } from '../../../core/component/aggregate-nodes'
import { RuntimeError, RUNTIME_ERRORS } from '../../../interpreter/errors'

/**
 * 把一個值拆成**有順序的幾格**。拆不開回 `null`——**不猜**。
 *
 * ⚠️ 判準是「這個型別登記過欄位順序嗎」，不是「它看起來像不像一對」
 * ——同族的查找元件為那個差別付過帳（一個可重複集合裝的每一格本身就是一對）。
 */
export function partsOf(v: RuntimeValue, ctx: ExecutionContext): RuntimeValue[] | null {
  if (v.type === 'object' && v.value instanceof Map) {
    /**
     * 🔴 **使用者自己的結構也拆得開**（2026-09-18，語料 2 支）。
     *
     * ⚠️ 而這一條是**探索報告量錯的那一格**：報告寫「綁到使用者自己的結構——語料 0 處」，
     * 而它數的是「右邊長什麼樣」（`ms.top()`／`BFS.front()`），**沒有去看那個容器裝什麼**。
     * `priority_queue<side> ms;` 的 `top()` 回的正是一個 `struct side`。
     *
     * > **一個「這個寫法語料有幾處」的讀數，如果只數了寫法而沒有數它作用在什麼上，
     * > 那它量到的是語法不是語義——而範圍是照語義決定的。**
     *
     * C++ 的規則是**按宣告順序取公開成員**，而 `fieldsOf` 給的就是那個順序。
     */
    const structName = String(v.structName ?? '')
    const shape = aggregateShapeOf(structName)
      ?? (structName ? ctx.structs.fieldsOf(structName).map((f) => f.name) : undefined)
    if (!shape || shape.length === 0) return null
    const m = v.value
    const out: RuntimeValue[] = []
    for (const f of shape) {
      const x = m.get(f)
      if (!x) return null
      out.push(x)
    }
    return out
  }
  if (v.type === 'array' && Array.isArray(v.value)) return v.value as RuntimeValue[]
  return null
}

/** 拆開並宣告。拆不開或格數不對就丟錯。 */
export function bindSequence(names: readonly string[], v: RuntimeValue, ctx: ExecutionContext): void {
  const parts = partsOf(v, ctx)
  if (!parts) {
    /**
     * 🟠 **誠實降級**：綁到原生陣列（`auto [a, b] = arr;`）——語料 **0 處**。
     * 🔴 何時該做：盲測或使用者的程式出現這個寫法。
     */
    throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, {
      '%1': `這個值拆不開成「${names.join(', ')}」——目前只拆得開一對值與一串值`,
    })
  }
  if (parts.length !== names.length) {
    throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, {
      '%1': `要拆成 ${names.length} 格，而右邊有 ${parts.length} 格`,
    })
  }
  /**
   * ⚠️ **這裡不複製**——聚合值是參考型別，而「複製一份」與「就地修改」
   * 的差別今天**模型上還表達不出來**：同族「一個名字指著容器裡某一格」的
   * 參考繫結今天一樣不支援。見 `spec.test.ts` 裡那根釘子與它的觸發條件。
   */
  names.forEach((n, i) => { ctx.scope.declare(n, parts[i]) })
}
