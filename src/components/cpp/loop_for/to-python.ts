/** 這顆元件寫成 Python（456）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { hasOwnContinue } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  // 一般的 for（計次的那一種由 loop_count 換成 range）：`for (init; cond; update) body` →
  //   init ／ while cond: ／ body ／ update——每圈重算條件、本體改了迴圈變數下一圈看得到，與 C++ 同義。
  // 少了條件就是 `while True`；`l++, r--` 這種逗號的更新由 comma_expr 拆成兩句。
  // ⚠️ continue 會跳過寫在最後的 update（C++ 的 continue 會先做 update）⟹ 本體有屬於這一圈的 continue 就保留。
  // init 宣告的變數在 C++ 只活在迴圈裡、Python 會留到迴圈之後——與外層同名的由 func_def 的同名檢查擋（456）
  r.stmt((n, py, depth) => {
    const body = n.slots.body ?? []
    if (hasOwnContinue(body)) return [py.keep(n, 'outside-subset', 'for 迴圈的本體有 continue（寫成 while 之後會跳過更新那一段）')]
    const notPass = (l: string): boolean => l.trim() !== 'pass'
    const cond = n.slots.cond?.[0]
    const inner = [...py.block(body, depth + 1), ...py.block(n.slots.update, depth + 1)].filter(notPass)
    return [
      ...py.block(n.slots.init, depth).filter(notPass),
      `${py.indent(depth)}while ${cond ? py.expr(cond) : 'True'}:`,
      ...(inner.length ? inner : [`${py.indent(depth + 1)}pass`]),
    ]
  })
}
