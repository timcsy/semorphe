/**
 * 這顆元件寫成 C++（spec 225 的延伸，history/382）：`try: … except ValueError: …` → `try { … } catch (const invalid_argument&) { … }`。
 *
 * 只收「本體裡會丟 ValueError 的，只有 `int(字串)`」那一種——它在 C++ 換成照 Python 規則丟 invalid_argument 的 `py_int`。
 * 其餘照實保留：
 * - 抓別的例外（ZeroDivisionError 在 C++ 是未定義行為，不是例外）、抓好幾種、`except ... as e`（印 e 的訊息兩邊不同）
 * - `else`／`finally`
 * - 本體裡有別的、在 Python 可能丟 ValueError 而 C++ 不丟的東西（`float(字串)`、`max([])`、自己寫的函式…）——用允許清單，不是禁止清單
 */
import type { ToCppRegistrar } from '../../../languages/python/to-cpp/contract'
import type { SemanticNode } from '../../../core/types'

/** 在 Python 不會丟 ValueError（或丟的在 C++ 也照樣丟）的元件 */
const SAFE = /:(var_assign|var_assign_compound|var_ref|literal_number|literal_string|literal_bool|arithmetic|compare|logic|logic_not|negate|print|input|break|continue|if|loop_while|container_size|container_at|container_assign|container_append|string_upper|string_lower|_compound)$/

function firstUnsafe(n: SemanticNode, pyType: (x: SemanticNode | undefined) => string | undefined): SemanticNode | undefined {
  if (n.componentId.endsWith(':cast')) {
    const v = n.slots.value?.[0]
    const from = pyType(v), to = String(n.properties.target_type ?? '')
    // int(字串) → py_int；int(整數) 不會丟；int(浮點) 遇到 nan 會丟 ValueError、float(字串) 的規則與 stod 不同 → 不收
    if (!(to === 'int' && (from === 'str' || from === 'int'))) return n
  } else if (!SAFE.test(n.componentId)) return n
  for (const c of Object.values(n.slots ?? {}).flat()) { const u = firstUnsafe(c, pyType); if (u) return u }
  return undefined
}

export function registerToCpp(r: ToCppRegistrar): void {
  r.stmt((n, cpp, depth) => {
    const handlers = n.slots.handlers ?? []
    const h = handlers[0]
    if (handlers.length !== 1 || String(h.properties.exception ?? '') !== 'ValueError') return [cpp.keep(n, 'outside-subset', '第一版只換「只抓 ValueError」的 try（ZeroDivisionError 在 C++ 不是例外）')]
    if (String(h.properties.alias ?? '') !== '') return [cpp.keep(n, 'outside-subset', '`except ValueError as e`：例外的訊息兩邊不同')]
    if ((n.slots.orelse ?? []).length > 0 || (n.slots.ensure ?? []).length > 0) return [cpp.keep(n, 'outside-subset', 'try 的 else／finally 第一版保留')]
    const bad = (n.slots.body ?? []).map((c) => firstUnsafe(c, (x) => cpp.pyType(x))).find(Boolean)
    if (bad) return [cpp.keep(bad, 'outside-subset', `try 裡的「${bad.componentId}」在 Python 可能丟 ValueError，換過去的 C++ 不一定丟同一種`)]
    const i = cpp.indent(depth)
    cpp.useInclude('stdexcept')
    return [
      `${i}try {`,
      ...cpp.inValueErrorTry(() => cpp.block(n.slots.body, depth + 1)),
      `${i}} catch (const invalid_argument&) {`,
      ...cpp.block(h.slots.body, depth + 1),
      `${i}}`,
    ]
  })
}
