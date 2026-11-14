/** 這顆元件寫成 Python（spec 219，research R7）。 */
import type { ToPythonRegistrar } from '../../../languages/cpp/to-python/contract'
import { hasOwnBreak, isSignedInt } from '../../../languages/cpp/to-python/contract'

export function registerToPython(r: ToPythonRegistrar): void {
  r.stmt((n, py, depth) => {
    const cond = n.slots.condition?.[0]
    const body = n.slots.body ?? []
    // `while (n--)`（457，學生的「做 n 次」）：先拿舊值判、再減、再跑本體 ⟹
    //   while n != 0: ／ n -= 1 ／ 本體，離開之後再減一次（C++ 判到 0 時也減了，n 停在 -1）。
    // break 出去的那一次不會多減 ⟹ 本體有自己的 break 保留；只收有號整數（無號的減到 0 以下會繞回）
    const x = cond?.slots?.target?.[0]
    if (cond?.properties?.operator === '--' && cond.properties.position === 'postfix' && typeof x?.properties?.name === 'string'
      && Object.values(x.slots ?? {}).every((k) => k.length === 0) && isSignedInt(py.typeOf(x))) {
      if (hasOwnBreak(body)) return [py.keep(n, 'outside-subset', 'while (n--) 的本體有 break（break 出去時 n 少減一次）')]
      const v = py.expr(x)
      const inner = py.block(body, depth + 1).filter((l) => l.trim() !== 'pass')
      return [`${py.indent(depth)}while ${v} != 0:`, `${py.indent(depth + 1)}${v} -= 1`, ...inner, `${py.indent(depth)}${v} -= 1`]
    }
    // `while (cin >> a >> b)`（459）：每讀一個先問還有沒有詞——沒有就離開（同 cin：EOF 時那個變數不動、迴圈結束；
    //   讀到一半沒了，前面讀到的留著）。⟹ while True: ／ if not has_token(): break ／ a = …（讀法同 cin >> 那一句）／ …／ 本體。
    //   本體的 continue 回到開頭再讀、break 照樣離開——與 C++ 相同
    if (cond && py.isStreamRead(cond) && (cond.slots.values?.length ?? 0) > 0) {
      const probe = py.useTokenProbe()
      const reads = (cond.slots.values ?? []).flatMap((v) => [
        `${py.indent(depth + 1)}if not ${probe}:`, `${py.indent(depth + 2)}break`,
        ...py.block([{ ...cond, slots: { ...cond.slots, values: [v] } }], depth + 1),
      ])
      const inner = py.block(body, depth + 1).filter((l) => l.trim() !== 'pass')
      return [`${py.indent(depth)}while True:`, ...reads, ...inner]
    }
    return [`${py.indent(depth)}while ${py.expr(cond)}:`, ...py.block(body, depth + 1)]
  })
}
